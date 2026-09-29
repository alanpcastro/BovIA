-- ════════════════════════════════════════════════════════════════════════════
-- Diagnóstico: animais cujo STATUS não bate com as MOVIMENTAÇÕES
-- ════════════════════════════════════════════════════════════════════════════
--
-- SOMENTE LEITURA: só SELECT, não altera nada.
-- Onde rodar: editor SQL do Neon, no banco de PRODUÇÃO. Copie tudo e execute.
--
-- Resultado VAZIO: nada a corrigir, assunto encerrado.
-- Com resultado: revisar caso a caso com o produtor. O sistema não tem como saber sozinho
-- qual lado está certo — por isso não há correção automática (CRITICOS_AUDITORIA.md, Bloco 4).
--
-- Os dois sentidos do problema:
--
--   A) STATUS DE SAÍDA SEM REGISTRO — animal "vendido", "morto" ou "transferido" sem a
--      movimentação correspondente. Ou faltou lançar a venda (e o financeiro não sabe dela),
--      ou o status foi marcado por engano.
--      Como resolver: lançar a movimentação que faltou, ou editar o animal de volta para
--      "ativo" (a edição permite, porque não há movimentação registrada).
--
--   B) SAÍDA REGISTRADA COM ANIMAL ATIVO — venda, morte ou transferência lançada, mas o
--      animal continua "ativo". O Financeiro soma essa receita para um animal que o sistema
--      diz estar no rebanho. Acontecia ao editar o animal de "vendido" para "ativo".
--      Como resolver: se o animal está mesmo na fazenda, excluir a movimentação em
--      Movimentações; se ele saiu de fato, editar o status para vendido/morto/transferido.
--
-- Colunas: problema, conta, animal (id e brinco), status atual, e — no caso B — a
-- movimentação encontrada, a data e o valor somado.
-- ════════════════════════════════════════════════════════════════════════════

WITH saidas AS (
    SELECT m.animal_id,
           m.tipo::text             AS tipo,
           MAX(m.data)              AS data,
           SUM(COALESCE(m.valor, 0)) AS valor
    FROM movimentacoes m
    WHERE m.tipo IN ('venda', 'morte', 'transferencia')
    GROUP BY m.animal_id, m.tipo
),
saida_esperada (status, tipo) AS (
    VALUES ('vendido', 'venda'), ('morto', 'morte'), ('transferido', 'transferencia')
)

SELECT 'A) status de saida sem registro'  AS problema,
       u.email                             AS conta,
       u.fazenda_nome                      AS fazenda,
       a.id                                AS animal_id,
       a.brinco,
       a.status::text                      AS status_atual,
       NULL::text                          AS movimentacao,
       NULL::date                          AS data_mov,
       NULL::float                         AS valor
FROM animais a
JOIN users u            ON u.id = a.user_id
JOIN saida_esperada e   ON e.status = a.status::text
WHERE a.deletado_em IS NULL
  AND NOT EXISTS (SELECT 1 FROM saidas s WHERE s.animal_id = a.id AND s.tipo = e.tipo)

UNION ALL

SELECT 'B) saida registrada com animal ativo',
       u.email,
       u.fazenda_nome,
       a.id,
       a.brinco,
       a.status::text,
       s.tipo,
       s.data,
       s.valor
FROM animais a
JOIN users u   ON u.id = a.user_id
JOIN saidas s  ON s.animal_id = a.id
WHERE a.deletado_em IS NULL
  AND a.status = 'ativo'

ORDER BY problema, conta, animal_id;
