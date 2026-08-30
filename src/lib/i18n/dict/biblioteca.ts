/** Traduções do módulo Biblioteca (PT/EN/ES). */
export const biblioteca = {
  booksReadOne: { pt: "{count} livro lido", en: "{count} book read", es: "{count} libro leído" },
  booksReadMany: {
    pt: "{count} livros lidos",
    en: "{count} books read",
    es: "{count} libros leídos",
  },
  pageTitle: { pt: "Sua Biblioteca", en: "Your Library", es: "Tu Biblioteca" },

  kpiBooksRead: { pt: "Livros Lidos", en: "Books Read", es: "Libros Leídos" },
  kpiBooksInYear: { pt: "Livros em {year}", en: "Books in {year}", es: "Libros en {year}" },
  kpiAvgRating: { pt: "Nota Média", en: "Average Rating", es: "Calificación Media" },
  kpiTotalPages: { pt: "Páginas Totais", en: "Total Pages", es: "Páginas Totales" },

  addBook: { pt: "Adicionar Livro", en: "Add Book", es: "Añadir Libro" },
  readingStats: {
    pt: "Estatísticas de Leitura",
    en: "Reading Statistics",
    es: "Estadísticas de Lectura",
  },

  title: { pt: "Título", en: "Title", es: "Título" },
  author: { pt: "Autor", en: "Author", es: "Autor" },
  pubYear: { pt: "Ano de publicação", en: "Publication year", es: "Año de publicación" },
  pagesNum: { pt: "Número de páginas", en: "Number of pages", es: "Número de páginas" },
  pages: { pt: "Páginas", en: "Pages", es: "Páginas" },
  ratingLabel: { pt: "Nota:", en: "Rating:", es: "Nota:" },
  rating1to5: { pt: "Nota (1 a 5)", en: "Rating (1 to 5)", es: "Nota (1 a 5)" },
  genre: { pt: "Gênero", en: "Genre", es: "Género" },
  finishedDate: { pt: "Data de Conclusão", en: "Completion Date", es: "Fecha de Finalización" },
  finishedOn: { pt: "Concluído em", en: "Completed on", es: "Completado el" },

  notesPlaceholder: {
    pt: "Minhas notas (principais ideias, citações)",
    en: "My notes (key ideas, quotes)",
    es: "Mis notas (ideas clave, citas)",
  },
  myNotes: { pt: "Minhas Anotações", en: "My Notes", es: "Mis Notas" },
  applicationsPlaceholder: {
    pt: "Aplicações práticas na vida/trabalho",
    en: "Practical applications in life/work",
    es: "Aplicaciones prácticas en la vida/trabajo",
  },
  applications: {
    pt: "Aplicações Práticas",
    en: "Practical Applications",
    es: "Aplicaciones Prácticas",
  },

  addToLibrary: {
    pt: "Adicionar à Biblioteca",
    en: "Add to Library",
    es: "Añadir a la Biblioteca",
  },
  searchPlaceholder: {
    pt: "Buscar título ou autor...",
    en: "Search title or author...",
    es: "Buscar título o autor...",
  },

  empty: { pt: "Nenhum livro encontrado.", en: "No books found.", es: "Ningún libro encontrado." },
  editBook: { pt: "Editar Livro", en: "Edit Book", es: "Editar Libro" },
  viewNotes: { pt: "Ver notas", en: "View notes", es: "Ver notas" },
  annotations: { pt: "Anotações & Citações", en: "Notes & Quotes", es: "Anotaciones y Citas" },

  confirmDelete: {
    pt: 'Excluir o livro "{title}"?',
    en: 'Delete the book "{title}"?',
    es: '¿Eliminar el libro "{title}"?',
  },

  toastRequired: {
    pt: "Título e autor são obrigatórios.",
    en: "Title and author are required.",
    es: "Título y autor son obligatorios.",
  },
  toastAdded: {
    pt: "Livro adicionado à biblioteca.",
    en: "Book added to your library.",
    es: "Libro añadido a la biblioteca.",
  },

  booksByMonth: {
    pt: "Livros por mês ({year})",
    en: "Books per month ({year})",
    es: "Libros por mes ({year})",
  },
  byGenre: { pt: "Por gênero", en: "By genre", es: "Por género" },
  ratingOverTime: {
    pt: "Notas ao longo do tempo",
    en: "Ratings over time",
    es: "Notas a lo largo del tiempo",
  },

  stars: { pt: "{n} estrela(s)", en: "{n} star(s)", es: "{n} estrella(s)" },
} as const;
