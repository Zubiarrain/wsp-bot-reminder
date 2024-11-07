export const createMessages = (
    companyName:string,
    companyPhoneNumber:string,
    appointmentDate:string,
    appointmentHour:string,
    clientPhoneNumber:string,
    clientName:string,) => {
    const notificationMessage = `Hola ${clientName}! Nos comunicamos para asegurar tu turno en *${companyName}*.

Nuestro objetivo es que cada emprendedor pueda sacar el máximo provecho de su tiempo y espacio de trabajo. Por eso, en esta ocasión te solicitamos confirmación de asistencia a tu turno del día *${appointmentDate}* a las *${appointmentHour} *.
`;
    const assistMessage = `Genial, asistirás! Ante cualquier inconveniente puedes comunicarte con ${companyName} al número ${companyPhoneNumber} para cancelar o reprogramar tu turno.`

    const notAssistClientMessage = 'Sentimos que no puedas asistir, pero estamos muy agradecidos que nos lo informes!'
    const notAssistCompanyMessage = `*CANCELACIÓN DE TURNO:* Su cliente *${clientName}*, número: ${clientPhoneNumber} *NO ASISTIRÁ* su turno del día *${appointmentDate}* a las *${appointmentHour} *`

    const resheduleClientMessage = `${companyName} se estará comunicando contigo desde el número ${companyPhoneNumber} para reprogramar tu turno. Muchas gracias!`
    const resheduleCompanyMessage = `*REPROGRAMACIÓN DE TURNO:* Su cliente *${clientName}*, número: ${clientPhoneNumber} quiere *reprogramar* su turno del día *${appointmentDate}* a las *${appointmentHour} *`

    return {notificationMessage,assistMessage,notAssistClientMessage,notAssistCompanyMessage,resheduleClientMessage,resheduleCompanyMessage}

}