import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { createMessages } from './utils/createMesagges'
import { readGoogleSheet } from './utils/google_sheets'
import { config } from './config'

const PORT = process.env.PORT ?? 3008

const asistFlow = addKeyword(EVENTS.ACTION)
.addAction(async (_, { flowDynamic, state }) => {
    await flowDynamic(state.get('assistMessage'))
})

const notAsistFlow = addKeyword(EVENTS.ACTION)
.addAction(async (_, { flowDynamic, state }) => {
    await flowDynamic(state.get('notAssistClientMessage'))
})
.addAction(async (_, { state, provider }) => {
    await provider.vendor.sendMessage(state.get('companyPhoneNumber'), state.get('notAssistCompanyMessage'), {})
})

const resheduledFlow = addKeyword(EVENTS.ACTION)
.addAction(async (_, { flowDynamic, state }) => {
    console.log('resheduled')
    await flowDynamic(state.get('resheduleClientMessage'))
})
.addAction(async (_, { state, provider }) => {
    await provider.vendor.sendMessage(state.get('companyPhoneNumber'), state.get('resheduleCompanyMessage'), {})
})

const optionsFlow = addKeyword(EVENTS.ACTION)
.addAnswer(
    [
        `Por favor ingresa una de las siguientes opciones:`,
        "",
        `*1.* - Asistiré`,
        `*2.* - Quiero reprogramar el turno`,
        `*3.* - No asistiré y no quiero reprogramar el turno`,
    ], 
    { capture: true },
    async (ctx, { gotoFlow }) => {
        const userAnswer = ctx.body
        console.log(userAnswer)
        if(userAnswer === '1'){
            return gotoFlow(asistFlow)
        } 
        if(userAnswer === '2'){
            return gotoFlow(resheduledFlow)
        } 
        if(userAnswer === '3'){
            return gotoFlow(notAsistFlow)
        } 
        return gotoFlow(exceptionFlow)
        }
)

const exceptionFlow = addKeyword(EVENTS.ACTION)
.addAction(async (_, { flowDynamic, gotoFlow }) => {
    await flowDynamic(`No tenemos esa opción 🤔. Por favor enviá *1*, *2* o *3* para registrar tu respuesta 🙌 `)
    return gotoFlow(optionsFlow)
})

const registerFlow = addKeyword(utils.setEvent('REGISTER_FLOW'))
.addAction(async (_, { flowDynamic, state, gotoFlow }) => {
    await flowDynamic(`${state.get('notificationMessage')}`)
    return gotoFlow(optionsFlow)
})

const welcomeFlow = addKeyword(EVENTS.WELCOME)
.addAnswer('Hola Nahueee')


const main = async () => {
    const adapterFlow = createFlow([registerFlow, optionsFlow, asistFlow, notAsistFlow, resheduledFlow])
    const adapterProvider = createProvider(Provider, {
        jwtToken: config.metaJwtToken,
        numberId: config.metaNumberId,
        verifyToken: config.metaVerifyToken,
        version: config.metaVersion,
        experimentalStore: true,  // Significantly reduces resource consumption
        timeRelease: 360000 * 24,    // Cleans up data every 24 hours (in milliseconds)
    })
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { sheetId } = req.body
            const {companyName, companyPhoneNumber, appointments} = await readGoogleSheet(sheetId)
            for (let index = 0; index < appointments.length; index++) {
                const appointment = appointments[index];
                console.log(appointment)
                const messages = createMessages(
                    companyName,companyPhoneNumber,appointment.appointmentDate,appointment.appointmentHour,appointment.clientPhoneNumber,appointment.clientName
                )
                console.log(messages)
                bot.state(appointment.clientPhoneNumber).update({notificationMessage:messages.notificationMessage})
                bot.state(appointment.clientPhoneNumber).update({assistMessage:messages.assistMessage})
                bot.state(appointment.clientPhoneNumber).update({notAssistClientMessage:messages.notAssistClientMessage})
                bot.state(appointment.clientPhoneNumber).update({notAssistCompanyMessage:messages.notAssistCompanyMessage})
                bot.state(appointment.clientPhoneNumber).update({resheduleClientMessage:messages.resheduleClientMessage})
                bot.state(appointment.clientPhoneNumber).update({resheduleCompanyMessage:messages.resheduleCompanyMessage})
                bot.state(appointment.clientPhoneNumber).update({companyPhoneNumber:companyPhoneNumber})

                await bot.dispatch('REGISTER_FLOW', { from: appointment.clientPhoneNumber, name:appointment.clientName })
                
            }
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
