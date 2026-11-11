
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

