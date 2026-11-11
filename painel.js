
const url = "https://ptwwetggnaolvoqmgguy.supabase.co";
const chave = "sb_publishable_m6Pjk6f_eWTdtWgqC5SEqw_cBBCcAiK";
const cliente = supabase.createClient(url, chave);

async function verificarAcesso() {
    try {
        const { data: { user }, error } =
            await cliente.auth.getUser();

        if (error || !user) {
            window.location.replace("index.html");
            return;
        }

        const { data: perfil, error: erroPerfil } =
            await cliente.from("perfis")
                .select("cargo, status")
                .eq("id", user.id)
                .single();

        if (erroPerfil || !perfil ||
            perfil.status !== "aprovado" ||
            perfil.cargo !== "dev") {

            await cliente.auth.signOut();
            window.location.replace("index.html");
            return;
        }

        document.getElementById("verificando").hidden = true;
        document.getElementById("painel-dev").hidden = false;

    } catch (erro) {
        document.getElementById("verificando").textContent =
            "Não foi possível verificar o acesso.";
    }
}

document.getElementById("sair").addEventListener("click", async () => {
    await cliente.auth.signOut();
    window.location.replace("index.html");
});

verificarAcesso();
