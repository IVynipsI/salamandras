
const SUPABASE_URL = "https://ptwwetggnaolvoqmgguy.supabase.co";

const SUPABASE_KEY = "sb_publishable_m6Pjk6f_eWTdtWgqC5SEqw_cBBCcAiK";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Cliente Supabase inicializado!");

const formulario = document.getElementById("form-cadastro");
const mensagem = document.getElementById("mensagem");

formulario.addEventListener("submit", async function(evento) {
    evento.preventDefault();

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    mensagem.textContent = "Enviando solicitação...";

    const { error } = await supabaseClient.auth.signUp({
        email: email,
        password: senha
    });

    if (error) {
        mensagem.textContent = "Erro: " + error.message;
    } else {
        mensagem.textContent =
            "Solicitação recebida! Confirme seu e-mail, se solicitado. " +
            "Seu acesso dependerá da aprovação de um administrador.";
    }
});

const formularioLogin = document.getElementById("form-login");
const mensagemLogin = document.getElementById("mensagem-login");

formularioLogin.addEventListener("submit", async function(evento) {
    evento.preventDefault();

    const email = document.getElementById("email-login").value.trim();
    const senha = document.getElementById("senha-login").value;

    mensagemLogin.textContent = "Verificando acesso...";

    try {
        // Verifica e-mail e senha
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (error) {
            mensagemLogin.textContent = "Falha no login: " + error.message;
            return;
        }

        // Busca o cargo e a aprovação do usuário
        const { data: perfil, error: erroPerfil } = await supabaseClient
            .from("perfis")
            .select("cargo, status")
            .eq("id", data.user.id)
            .single();

        // Bloqueia quem não está aprovado
        if (erroPerfil || !perfil || perfil.status !== "aprovado") {
            await supabaseClient.auth.signOut();

            mensagemLogin.textContent =
                "Acesso não autorizado. Aguarde a aprovação de um administrador.";

            return;
        }

        // Usuário aprovado
        mensagemLogin.textContent =
            "Login autorizado! Seu cargo é: " + perfil.cargo;

if (perfil.cargo === "dev") {
    document.getElementById("painel-dev").hidden = false;
}


    } catch (erro) {
        await supabaseClient.auth.signOut();

        mensagemLogin.textContent =
            "Não foi possível verificar sua autorização.";
    }
});

