-- SALAMANDRAS / MATTIUZ - ATUALIZACAO 18
-- Cadastro publico controlado por empresa, convites permanecem.
-- EXECUTE APOS SQL 17. Nao apaga dados.
BEGIN;
ALTER TABLE public.docerias
  ADD COLUMN IF NOT EXISTS cadastro_publico_habilitado boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.api_13d_empresas_cadastro()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((
  SELECT pg_catalog.jsonb_agg(
   pg_catalog.jsonb_build_object('id',d.id,'nome',d.nome) ORDER BY d.nome)
  FROM public.docerias d
  WHERE d.situacao_erp='ativa' AND d.cadastro_publico_habilitado
 ),'[]'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.api_13d_empresas_cadastro() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_13d_empresas_cadastro() TO anon,authenticated;

-- A escolha da empresa enviada pelo visitante so e aceita
-- se o cadastro publico daquela empresa estiver efetivamente aberto.
CREATE OR REPLACE FUNCTION public.erp13d_vincular_cadastro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id text;v_empresa uuid;
BEGIN
 v_id:=NEW.raw_user_meta_data->>'empresa_solicitada_id';
 IF v_id IS NOT NULL
  AND v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN
  v_empresa:=v_id::uuid;
  IF EXISTS(SELECT 1 FROM public.docerias d WHERE d.id=v_empresa
   AND d.situacao_erp='ativa' AND d.cadastro_publico_habilitado)
  THEN
   INSERT INTO public.perfis(id,doceria_id)
   VALUES(NEW.id,v_empresa)
   ON CONFLICT(id) DO UPDATE SET doceria_id=EXCLUDED.doceria_id
    WHERE public.perfis.status='pendente'
    AND public.perfis.cargo<>'dev'
    AND public.perfis.doceria_id IS NULL;
  ELSE
   RAISE EXCEPTION 'O cadastro publico desta empresa esta fechado. Solicite um convite';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.erp13d_vincular_cadastro()
 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.api_18_cadastro_publico_definir(
 p_empresa uuid,p_habilitado boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.eh_dev() THEN RAISE EXCEPTION 'Somente DEV altera cadastro publico'; END IF;
 IF p_habilitado IS NULL THEN RAISE EXCEPTION 'Informe se deseja habilitar ou desabilitar'; END IF;
 UPDATE public.docerias SET cadastro_publico_habilitado=p_habilitado
 WHERE id=p_empresa AND situacao_erp='ativa';
 IF NOT FOUND THEN RAISE EXCEPTION 'Empresa nao encontrada ou nao esta ativa'; END IF;
 RETURN CASE WHEN p_habilitado THEN 'Cadastro publico habilitado' ELSE 'Cadastro publico desabilitado' END;
END $$;
REVOKE ALL ON FUNCTION public.api_18_cadastro_publico_definir(uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_18_cadastro_publico_definir(uuid,boolean)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.api_12_empresas_lista()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.eh_dev() THEN RAISE EXCEPTION 'Acesso exclusivo ao DEV'; END IF;
 RETURN COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',d.id,'nome',d.nome,'situacao',d.situacao_erp,
  'segmento',d.segmento_erp,'tema',d.tema_loja_erp,
  'slug',d.slug,'cadastro_publico',d.cadastro_publico_habilitado
 ) ORDER BY d.nome)
 FROM public.docerias d),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.api_12_empresas_lista()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_12_empresas_lista() TO authenticated;
COMMIT;

-- Empresas com cadastro publico habilitado por padrao: NENHUMA.
-- Os convites individuais SQL 17 continuam disponiveis.
-- ATENCAO: a exclusao definitiva de empresas com dependencias
-- exige migracao propria validada em ambiente de teste.
