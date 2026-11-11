
const SUPABASE_URL = "https://ptwwetggnaolvoqmgguy.supabase.co";

const SUPABASE_KEY = "sb_publishable_m6Pjk6f_eWTdtWgqC5SEqw_cBBCcAiK";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Cliente Supabase inicializado!");
