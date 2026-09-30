/** Textos de autenticação (login, cadastro, recuperação e modal). */
export const auth = {
  "title.login": { pt: "Entrar no ALTUS", en: "Sign in to ALTUS", es: "Iniciar sesión en ALTUS" },
  "title.signup": { pt: "Criar sua conta", en: "Create your account", es: "Crea tu cuenta" },
  "title.reset": { pt: "Recuperar senha", en: "Recover password", es: "Recuperar contraseña" },
  "title.newPassword": {
    pt: "Definir nova senha",
    en: "Set a new password",
    es: "Establecer nueva contraseña",
  },

  "subtitle.login": {
    pt: "Acesse seus registros de qualquer lugar.",
    en: "Access your records from anywhere.",
    es: "Accede a tus registros desde cualquier lugar.",
  },
  "subtitle.signup": {
    pt: "Seus dados ficam salvos na nuvem, só seus.",
    en: "Your data is saved in the cloud, only yours.",
    es: "Tus datos se guardan en la nube, solo tuyos.",
  },
  "subtitle.reset": {
    pt: "Enviamos um link de redefinição para o seu e-mail.",
    en: "We sent a reset link to your email.",
    es: "Enviamos un enlace de restablecimiento a tu correo.",
  },
  "subtitle.newPassword": {
    pt: "Escolha uma nova senha para sua conta.",
    en: "Choose a new password for your account.",
    es: "Elige una nueva contraseña para tu cuenta.",
  },

  "action.login": { pt: "Entrar", en: "Sign in", es: "Iniciar sesión" },
  "action.signup": { pt: "Criar conta", en: "Create account", es: "Crear cuenta" },
  "action.reset": { pt: "Enviar link", en: "Send link", es: "Enviar enlace" },
  "action.updatePassword": {
    pt: "Salvar nova senha",
    en: "Save new password",
    es: "Guardar nueva contraseña",
  },

  "notice.signup": {
    pt: "Conta criada! Confirme o e-mail que enviamos e depois faça login.",
    en: "Account created! Confirm the email we sent and then sign in.",
    es: "¡Cuenta creada! Confirma el correo que enviamos y luego inicia sesión.",
  },
  "notice.reset": {
    pt: "Se existir uma conta com esse e-mail, o link de redefinição chegou na caixa de entrada.",
    en: "If an account exists for this email, the reset link arrived in your inbox.",
    es: "Si existe una cuenta con este correo, el enlace de restablecimiento llegó a tu bandeja de entrada.",
  },
  "notice.passwordUpdated": {
    pt: "Senha atualizada! Você será levado ao login para entrar com a nova senha.",
    en: "Password updated! You'll be taken to sign in with your new password.",
    es: "¡Contraseña actualizada! Irás al inicio de sesión para entrar con tu nueva contraseña.",
  },

  "error.generic": {
    pt: "Algo deu errado. Tente de novo.",
    en: "Something went wrong. Try again.",
    es: "Algo salió mal. Inténtalo de nuevo.",
  },
  "error.passwordTooShort": {
    pt: "A nova senha precisa ter pelo menos 6 caracteres.",
    en: "The new password must be at least 6 characters.",
    es: "La nueva contraseña debe tener al menos 6 caracteres.",
  },
  "error.passwordMismatch": {
    pt: "As senhas não coincidem.",
    en: "Passwords don't match.",
    es: "Las contraseñas no coinciden.",
  },

  "label.email": { pt: "E-mail", en: "Email", es: "Correo" },
  "label.password": { pt: "Senha", en: "Password", es: "Contraseña" },
  "label.newPassword": { pt: "Nova senha", en: "New password", es: "Nueva contraseña" },
  "label.confirmPassword": {
    pt: "Confirmar nova senha",
    en: "Confirm new password",
    es: "Confirmar nueva contraseña",
  },
  "placeholder.password": {
    pt: "Mínimo de 6 caracteres",
    en: "Minimum 6 characters",
    es: "Mínimo 6 caracteres",
  },
  "placeholder.confirmPassword": {
    pt: "Repita a nova senha",
    en: "Repeat the new password",
    es: "Repite la nueva contraseña",
  },

  or: { pt: "ou", en: "or", es: "o" },
  continueGoogle: {
    pt: "Continuar com Google",
    en: "Continue with Google",
    es: "Continuar con Google",
  },
  "error.google": {
    pt: "Falha ao entrar com Google.",
    en: "Failed to sign in with Google.",
    es: "Error al iniciar sesión con Google.",
  },

  noAccount: { pt: "Não tem conta?", en: "No account yet?", es: "¿No tienes cuenta?" },
  createNow: { pt: "Criar agora", en: "Create now", es: "Crear ahora" },
  forgotPassword: {
    pt: "Esqueci minha senha",
    en: "Forgot my password",
    es: "Olvidé mi contraseña",
  },
  backToLogin: { pt: "Voltar para o login", en: "Back to login", es: "Volver al inicio de sesión" },

  "notConfigured.lead": {
    pt: "O login não está configurado. Defina ",
    en: "Login is not configured. Set ",
    es: "El inicio de sesión no está configurado. Define ",
  },
  "notConfigured.trail": {
    pt: " nas variáveis de ambiente do projeto.",
    en: " in the project environment variables.",
    es: " en las variables de entorno del proyecto.",
  },

  confirmDelete: {
    pt: "Tem certeza que deseja excluir este registro?",
    en: "Are you sure you want to delete this record?",
    es: "¿Estás seguro de que deseas eliminar este registro?",
  },
} as const;
