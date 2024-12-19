import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
  EVENTS,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { service } from "./utils/google_sheets";
import { Appointment } from "./definitions/appointment";
import { composingRandomTime, getRandomTimeWaiting } from "./utils/waitTime";
import { config } from "dotenv";
config();

const PORT = process.env.PORT ?? 3008;

const registerFlow = addKeyword(utils.setEvent("REGISTER_FLOW")).addAction(
  async (ctx, { state, endFlow, provider }) => {
    return endFlow(`${state.get("remainderMessage")}`);
  }
);

const welcomeFlow = addKeyword(EVENTS.WELCOME).addAction(
  async (ctx, { endFlow, provider }) => {
    await provider.vendor.readMessages([ctx.key]);
    await composingRandomTime(ctx, provider);
    const messages = await service.processPatientResponse(ctx.from, ctx.body);
    if (messages.clinicResponse) {
      const prov: BaileysProvider = provider;
      prov.vendor.sendMessage(
        `${messages.reprogrammingPhoneNumber}@s.whatsapp.net`,
        {
          text: messages.clinicResponse,
        }
      );
    }
    return endFlow(messages.patientResponse);
  }
);

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, registerFlow]);
  const adapterProvider = createProvider(
    BaileysProvider, //Provider,
    {
      /* jwtToken: config.metaJwtToken,
        numberId: config.metaNumberId,
        verifyToken: config.metaVerifyToken,
        version: config.metaVersion, */
      experimentalStore: true, // Significantly reduces resource consumption
      timeRelease: 360000 * 24, // Cleans up data every 24 hours (in milliseconds)
    }
  );
  const adapterDB = new Database();

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body;
      await bot.sendMessage(number, message, { media: urlMedia ?? null });
      return res.end("sended");
    })
  );

  adapterProvider.server.post(
    "/v1/register",
    handleCtx(async (bot, req, res) => {
      console.log("Llegó post");
      const appointments: Appointment[] = await service.fetchAppointments();
      const appointmentSent: Appointment[] = [];
      console.log(`Tenemos ${appointments.length} turnos`);
      for (let index = 0; index < appointments.length; index++) {
        const appointment = appointments[index];
        console.log(`Enviando a ${appointment.patientPhoneNumber}...`);
        const onWhats = await bot.provider.vendor.onWhatsApp(
          appointment.patientPhoneNumber
        );
        if (onWhats[0]?.exists) {
          bot
            .state(appointment.patientPhoneNumber)
            .update({ remainderMessage: appointment.remainderMessage });

          await bot.dispatch("REGISTER_FLOW", {
            from: appointment.patientPhoneNumber,
            name: "",
          });

          appointmentSent.push(appointment);
          console.log("Enviado");
        }

        await new Promise((resolve) =>
          setTimeout(resolve, getRandomTimeWaiting(20000, 40000))
        );
      }
      await service.markAsSent(appointmentSent);
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body;
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    })
  );

  httpServer(+PORT);
};

main();
