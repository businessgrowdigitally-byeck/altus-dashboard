/** Textos do módulo de Estudos & Conhecimento. */
export const estudos = {
  pageTitle: { pt: "Centro de Conhecimento", en: "Knowledge Center", es: "Centro de Conocimiento" },
  pageSubtitle: {
    pt: "O que você aprendeu hoje?",
    en: "What did you learn today?",
    es: "¿Qué aprendiste hoy?",
  },

  kpiEntradas: { pt: "Entradas este mês", en: "Entries this month", es: "Entradas este mes" },
  kpiHoras: { pt: "Horas estudadas", en: "Hours studied", es: "Horas estudiadas" },
  kpiStreak: { pt: "Streak atual", en: "Current streak", es: "Racha actual" },
  kpiProgresso: { pt: "Em progresso", en: "In progress", es: "En progreso" },

  diary: { pt: "Diário de Estudos", en: "Study Diary", es: "Diario de Estudios" },
  statusConcluido: { pt: "Concluído", en: "Completed", es: "Completado" },
  statusProgresso: { pt: "Em Progresso", en: "In Progress", es: "En Progreso" },
  emptyDiary: {
    pt: "Nenhuma entrada registrada ainda.",
    en: "No entries recorded yet.",
    es: "Ninguna entrada registrada todavía.",
  },
  verMais: { pt: "Ver mais", en: "See more", es: "Ver más" },

  novaEntrada: { pt: "Nova Entrada", en: "New Entry", es: "Nueva Entrada" },
  data: { pt: "Data", en: "Date", es: "Fecha" },
  topico: { pt: "Tópico / Assunto", en: "Topic / Subject", es: "Tema / Asunto" },
  area: { pt: "Área", en: "Area", es: "Área" },
  formato: { pt: "Formato", en: "Format", es: "Formato" },
  duracao: { pt: "Duração (minutos)", en: "Duration (minutes)", es: "Duración (minutos)" },
  oQueAprendi: { pt: "O que aprendi", en: "What I learned", es: "Lo que aprendí" },
  insights: { pt: "Insights-chave", en: "Key insights", es: "Ideas clave" },
  status: { pt: "Status", en: "Status", es: "Estado" },
  registrar: { pt: "Registrar Estudo", en: "Register Study", es: "Registrar Estudio" },

  minhasAreas: { pt: "Minhas Áreas (mês)", en: "My Areas (month)", es: "Mis Áreas (mes)" },
  semDados: { pt: "Sem dados.", en: "No data.", es: "Sin datos." },

  horasSemana: {
    pt: "Horas por Semana (12 semanas)",
    en: "Hours per Week (12 weeks)",
    es: "Horas por Semana (12 semanas)",
  },

  editar: { pt: "Editar Estudo", en: "Edit Study", es: "Editar Estudio" },
  editarBtn: { pt: "Editar", en: "Edit", es: "Editar" },
  cancelar: { pt: "Cancelar", en: "Cancel", es: "Cancelar" },
  salvarAlteracoes: { pt: "Salvar Alterações", en: "Save Changes", es: "Guardar Cambios" },

  toastTema: {
    pt: "Informe o tema que você estudou.",
    en: "Provide the topic you studied.",
    es: "Indica el tema que estudiaste.",
  },
  toastDuracao: {
    pt: "Informe a duração do estudo em minutos.",
    en: "Provide the study duration in minutes.",
    es: "Indica la duración del estudio en minutos.",
  },
  toastRegistrado: { pt: "Estudo registrado.", en: "Study registered.", es: "Estudio registrado." },

  confirmDelete: {
    pt: 'Excluir o estudo "{topic}"?',
    en: 'Delete the study "{topic}"?',
    es: '¿Eliminar el estudio "{topic}"?',
  },
} as const;
