export interface Appointment {
  patientPhoneNumber: string;
  remainderMessage: string;
  rows: number[]; // Índices de las filas en el Google Sheet
}
