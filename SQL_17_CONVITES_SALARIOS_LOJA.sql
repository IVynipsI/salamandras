-- MATTIUZ / SALAMANDRAS - ATUALIZACAO 17
-- Privacidade de empresas, convites individuais, cargos e salarios.
-- Fazer backup e executar por inteiro no Supabase -> SQL Editor.
-- Esta migracao nao exclui empresas nem usuarios existentes.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.perfis') IS NULL OR to_regclass('public.erp13_funcionarios') IS NULL
 OR to_regclass('public.docerias') IS NULL OR to_regprocedure('private.pode(uuid,text[])') IS NULL
 THEN RAISE EXCEPTION 'Instale as versoes anteriores do Salamandras antes da ATT 17'; END IF;
END $$;

-- A listagem publica nao divulga nomes nem IDs de empresas.
CREATE OR REPLACE FUNCTION public.api_13d_empresas_cadastro()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT '[]'::jsonb;
$$;
REVOKE ALL ON FUNCTION public.api_13d_empresas_cadastro() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_13d_empresas_cadastro() TO authenticated;

-- Desabilita a vinculacao de empresa por raw_user_meta_data nao confiavel.
CREATE OR REPLACE FUNCTION public.erp13d_vincular_cadastro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.erp17_convites(
 token_hash text PRIMARY KEY,
 doceria_id uuid NOT NULL REFERENCES public.docerias(id),
 email text NOT NULL,
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 expira_em timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 consumido_por uuid REFERENCES auth.users(id),
 consumido_em timestamptz
);
CREATE INDEX IF NOT EXISTS erp17_convites_email_idx ON public.erp17_convites(email,doceria_id);
ALTER TABLE public.erp17_convites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp17_convites FROM PUBLIC,anon,authenticated;

-- Somente ADM da empresa ou DEV gera convite especifico para um email.
CREATE OR REPLACE FUNCTION public.api_17_convite_criar(p_empresa uuid,p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text;v_token text;
BEGIN
 IF NOT private.pode(p_empresa,ARRAY['adm']) THEN
  RAISE EXCEPTION 'Somente ADM da empresa ou DEV pode convidar'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.docerias
  WHERE id=p_empresa AND situacao_erp='ativa') THEN RAISE EXCEPTION 'Empresa inativa'; END IF;
 v_email:=pg_catalog.lower(pg_catalog.btrim(COALESCE(p_email,'')));
 IF pg_catalog.length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 THEN RAISE EXCEPTION 'Email invalido'; END IF;
 v_token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 INSERT INTO public.erp17_convites(token_hash,doceria_id,email,criado_por)
 VALUES(pg_catalog.md5(v_token),p_empresa,v_email,auth.uid());
 RETURN v_token;
END $$;

-- A verificacao so indica se o convite e valido; nunca lista empresas.
CREATE OR REPLACE FUNCTION public.api_17_convite_validar(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$'
 THEN RETURN '{"valido":false}'::jsonb; END IF;
 RETURN pg_catalog.jsonb_build_object('valido',EXISTS(
 SELECT 1 FROM public.erp17_convites c JOIN public.docerias d ON d.id=c.doceria_id
 WHERE c.token_hash=pg_catalog.md5(p_token) AND c.consumido_em IS NULL
 AND c.expira_em>now() AND d.situacao_erp='ativa'));
END $$;

-- Vinculo so apos autenticar e confirmar O MESMO email do convite.
-- Nao aprova o perfil: o ADM/DEV precisa aprovar depois.
CREATE OR REPLACE FUNCTION public.api_17_convite_aceitar(p_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.erp17_convites%ROWTYPE;v_email text;v_p public.perfis%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'Convite invalido'; END IF;
 SELECT * INTO v FROM public.erp17_convites WHERE token_hash=pg_catalog.md5(p_token) FOR UPDATE;
 IF NOT FOUND OR v.expira_em<=now() OR v.consumido_em IS NOT NULL
 THEN RAISE EXCEPTION 'Convite invalido, utilizado ou expirado'; END IF;
 SELECT pg_catalog.lower(pg_catalog.btrim(email)) INTO v_email FROM auth.users
 WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Confirme o e-mail antes de usar o convite'; END IF;
 IF v_email<>v.email THEN RAISE EXCEPTION 'Convite destinado a outro e-mail'; END IF;
 SELECT * INTO v_p FROM public.perfis WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR v_p.status<>'pendente' OR v_p.cargo='dev' OR
 (v_p.doceria_id IS NOT NULL AND v_p.doceria_id<>v.doceria_id)
 THEN RAISE EXCEPTION 'Conta nao elegivel para este convite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.docerias WHERE id=v.doceria_id AND situacao_erp='ativa')
 THEN RAISE EXCEPTION 'Empresa indisponivel'; END IF;
 UPDATE public.perfis SET doceria_id=v.doceria_id WHERE id=auth.uid();
 UPDATE public.erp17_convites SET consumido_por=auth.uid(),consumido_em=now()
 WHERE token_hash=v.token_hash;
 RETURN 'Cadastro solicitado. Aguarde aprovacao';
END $$;
REVOKE ALL ON FUNCTION public.api_17_convite_criar(uuid,text),
 public.api_17_convite_validar(text),public.api_17_convite_aceitar(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_17_convite_criar(uuid,text),
 public.api_17_convite_aceitar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_17_convite_validar(text) TO anon,authenticated;

-- Bloqueia o antigo codigo generico de empresa.
DO $$
BEGIN
 IF to_regprocedure('public.api_solicitar_doceria(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.api_solicitar_doceria(text) FROM PUBLIC,anon,authenticated';
 END IF;
END $$;

-- Somente o DEV pode conceder, retirar ou mover ADMs.
-- Vale mesmo se chamadas antigas tentarem usar outra RPC.
CREATE OR REPLACE FUNCTION public.erp17_proteger_adm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ((NEW.cargo='adm' AND OLD.cargo IS DISTINCT FROM 'adm')
 OR (OLD.cargo='adm' AND (
  NEW.cargo IS DISTINCT FROM OLD.cargo OR NEW.doceria_id IS DISTINCT FROM OLD.doceria_id
  OR NEW.status IS DISTINCT FROM OLD.status)))
 AND NOT EXISTS(SELECT 1 FROM public.perfis a WHERE a.id=auth.uid()
 AND a.cargo='dev' AND a.status='aprovado')
 THEN RAISE EXCEPTION 'Somente DEV pode nomear, remover ou modificar ADMs'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS erp17_proteger_adm ON public.perfis;
CREATE TRIGGER erp17_proteger_adm BEFORE UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.erp17_proteger_adm();

-- Salarios: permissao especial, separada de RH e dos cargos.
CREATE TABLE IF NOT EXISTS public.erp17_salarios_acessos(
 doceria_id uuid NOT NULL REFERENCES public.docerias(id),
 usuario_id uuid NOT NULL REFERENCES public.perfis(id),
 autorizado_por uuid NOT NULL REFERENCES auth.users(id),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(doceria_id,usuario_id)
);
ALTER TABLE public.erp17_salarios_acessos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp17_salarios_acessos FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.api_17_salarios_autorizar(
 p_empresa uuid,p_usuario uuid,p_permitido boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.perfis p WHERE p.id=auth.uid() AND p.status='aprovado'
 AND (p.cargo='dev' OR (p.cargo='adm' AND p.doceria_id=p_empresa)))
 THEN RAISE EXCEPTION 'Somente ADM/DEV pode delegar a edicao salarial'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=p_usuario AND doceria_id=p_empresa
 AND status='aprovado' AND cargo<>'dev')
 THEN RAISE EXCEPTION 'Funcionario nao encontrado'; END IF;
 IF p_permitido IS NULL THEN RAISE EXCEPTION 'Escolha uma autorizacao'; END IF;
 IF p_permitido THEN
 INSERT INTO public.erp17_salarios_acessos(doceria_id,usuario_id,autorizado_por)
 VALUES(p_empresa,p_usuario,auth.uid())
 ON CONFLICT(doceria_id,usuario_id) DO UPDATE
 SET autorizado_por=EXCLUDED.autorizado_por,atualizado_em=now();
 ELSE
 DELETE FROM public.erp17_salarios_acessos WHERE doceria_id=p_empresa AND usuario_id=p_usuario;
 END IF;
 INSERT INTO public.auditoria_operacoes(doceria_id,autor_id,entidade,acao,registro_id,detalhes)
 VALUES(p_empresa,auth.uid(),'rh',
 CASE WHEN p_permitido THEN 'autorizar_salarios' ELSE 'revogar_salarios' END,
 p_usuario,pg_catalog.jsonb_build_object('autorizado',p_permitido));
 RETURN 'Permissao salarial atualizada';
END $$;

CREATE OR REPLACE FUNCTION public.erp17_proteger_salario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_anterior numeric;
BEGIN
 v_anterior:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.salario_base END;
 IF NEW.salario_base IS DISTINCT FROM v_anterior THEN
  IF NOT EXISTS(SELECT 1 FROM public.perfis p WHERE p.id=auth.uid() AND p.status='aprovado'
  AND (p.cargo='dev' OR (p.cargo='adm' AND p.doceria_id=NEW.doceria_id)))
  AND NOT EXISTS(SELECT 1 FROM public.erp17_salarios_acessos a JOIN public.perfis p
  ON p.id=a.usuario_id WHERE p.id=auth.uid() AND p.status='aprovado'
  AND p.doceria_id=NEW.doceria_id AND a.doceria_id=NEW.doceria_id)
  THEN RAISE EXCEPTION 'Sem permissao para alterar salarios'; END IF;
  INSERT INTO public.auditoria_operacoes(doceria_id,autor_id,entidade,acao,registro_id,detalhes)
  VALUES(NEW.doceria_id,auth.uid(),'rh','alterar_salario',NEW.usuario_id,
   pg_catalog.jsonb_build_object('antes',v_anterior,'depois',NEW.salario_base));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS erp17_proteger_salario ON public.erp13_funcionarios;
CREATE TRIGGER erp17_proteger_salario BEFORE INSERT OR UPDATE OF salario_base ON public.erp13_funcionarios
FOR EACH ROW EXECUTE FUNCTION public.erp17_proteger_salario();
REVOKE ALL ON FUNCTION public.api_17_salarios_autorizar(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_17_salarios_autorizar(uuid,uuid,boolean) TO authenticated;

-- Corrige a restricao de visualizacao da loja para ADM e DEV.
CREATE OR REPLACE FUNCTION public.api_config_doceria(p_doceria uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.pode(p_doceria,ARRAY['adm']) THEN
 RAISE EXCEPTION 'Somente ADM/DEV da empresa'; END IF;
 RETURN (SELECT pg_catalog.to_jsonb(d)-'codigo_convite'
 FROM public.docerias d WHERE d.id=p_doceria);
END $$;
REVOKE ALL ON FUNCTION public.api_config_doceria(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_config_doceria(uuid) TO authenticated;

-- Permite que ADM publique a propria loja e altere suas imagens.
CREATE OR REPLACE FUNCTION public.api_editar_doceria(
 p_doceria uuid,p_nome text,p_slug text,p_publicado boolean,
 p_whatsapp text,p_instagram text,p_descricao text,p_endereco text,p_horario text,
 p_capa text,p_local text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.docerias%ROWTYPE;v_fone text;v_slug text;
BEGIN
 SELECT * INTO v FROM public.docerias WHERE id=p_doceria FOR UPDATE;
 IF NOT FOUND OR NOT private.pode(p_doceria,ARRAY['adm'])
 THEN RAISE EXCEPTION 'Somente ADM/DEV da empresa'; END IF;
 v_slug:=pg_catalog.lower(pg_catalog.btrim(COALESCE(p_slug,'')));
 v_fone:=pg_catalog.regexp_replace(COALESCE(p_whatsapp,''),'[^0-9]','','g');
 IF pg_catalog.length(pg_catalog.btrim(COALESCE(p_nome,'')))<2 OR
 (v_slug<>'' AND v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$') OR
 pg_catalog.length(v_slug)>60 OR
 (v_fone<>'' AND pg_catalog.length(v_fone) NOT BETWEEN 12 AND 13)
 OR p_publicado IS NULL THEN RAISE EXCEPTION 'Nome, slug ou WhatsApp invalido'; END IF;
 IF p_publicado AND v_slug='' THEN RAISE EXCEPTION 'Defina o slug antes de publicar'; END IF;
 IF NOT private.imagem_guardada(p_doceria,'capa',p_capa)
 AND p_capa IS DISTINCT FROM v.imagem_capa_url
 THEN RAISE EXCEPTION 'Capa nao autorizada'; END IF;
 IF NOT private.imagem_guardada(p_doceria,'local',p_local)
 AND p_local IS DISTINCT FROM v.imagem_local_url
 THEN RAISE EXCEPTION 'Imagem nao autorizada'; END IF;
 UPDATE public.docerias SET nome=pg_catalog.btrim(p_nome),slug=NULLIF(v_slug,''),
 site_publicado=p_publicado,whatsapp_site=NULLIF(v_fone,''),
 instagram_site=NULLIF(pg_catalog.btrim(COALESCE(p_instagram,'')),''),
 descricao_site=NULLIF(pg_catalog.btrim(COALESCE(p_descricao,'')),''),
 endereco_site=NULLIF(pg_catalog.btrim(COALESCE(p_endereco,'')),''),
 horario_site=NULLIF(pg_catalog.btrim(COALESCE(p_horario,'')),''),
 imagem_capa_url=p_capa,imagem_local_url=p_local WHERE id=p_doceria;
 INSERT INTO public.auditoria_operacoes(doceria_id,autor_id,entidade,acao,registro_id)
 VALUES(p_doceria,auth.uid(),'empresa','editar_loja',p_doceria);
 RETURN 'Loja atualizada';
END $$;
REVOKE ALL ON FUNCTION public.api_editar_doceria(uuid,text,text,boolean,text,text,text,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_editar_doceria(uuid,text,text,boolean,text,text,text,text,text,text,text)
 TO authenticated;
COMMIT;

-- ATENCAO: o convite e gerado para envio manual por e-mail.
-- A confirmacao de e-mail deve estar ativa em Supabase Authentication.
-- Teste as permissoes DEV, ADM e funcionario antes da producao.
