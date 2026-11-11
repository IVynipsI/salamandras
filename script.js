
const SUPABASE_URL = "https://ptwwetggnaolvoqmgguy.supabase.co";
const SUPABASE_KEY = "sb_publishable_m6Pjk6f_eWTdtWgqC5SEqw_cBBCcAiK";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Cliente Supabase inicializado!");

// CADASTRO
const formulario = document.getElementById("form-cadastro");
const mensagem = document.getElementById("mensagem");

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value;

    mensagem.textContent = "Enviando solicitação...";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password: senha
        });

        if (error) {
            mensagem.textContent = "Erro: " + error.message;
            return;
        }

        if (data.session) {
            await supabaseClient.auth.signOut();
        }

        mensagem.textContent =
            "Solicitação recebida! Confirme seu e-mail, se solicitado. Aguarde a aprovação.";
    } catch (erro) {
        mensagem.textContent = "Erro ao solicitar cadastro.";
    }
});

// LOGIN
const formularioLogin = document.getElementById("form-login");
const mensagemLogin = document.getElementById("mensagem-login");

formularioLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const email = document.getElementById("email-login").value.trim();
    const senha = document.getElementById("senha-login").value;

    mensagemLogin.textContent = "Verificando acesso...";

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password: senha
            });

        if (error) {
            mensagemLogin.textContent = "Erro: " + error.message;
            return;
        }

        const { data: perfil, error: erroPerfil } =
            await supabaseClient
                .from("perfis")
                .select("cargo, status")
                .eq("id", data.user.id)
                .single();

        if (erroPerfil || !perfil || perfil.status !== "aprovado") {
            await supabaseClient.auth.signOut();
            mensagemLogin.textContent =
                "Acesso não autorizado. Aguarde aprovação.";
            return;
        }

        if (perfil.cargo === "dev") {
            window.location.href = "painel.html";
            return;
        }

        await supabaseClient.auth.signOut();
        mensagemLogin.textContent =
            "Seu acesso foi aprovado. O painel do seu cargo está em desenvolvimento.";

    } catch (erro) {
        await supabaseClient.auth.signOut();
        mensagemLogin.textContent =
            "Não foi possível verificar sua autorização.";
    }
});
