-- ════════════════════════════════════════════════════════════════════════════
-- Diagnóstico: registros ligados a dados de OUTRA conta
-- ════════════════════════════════════════════════════════════════════════════
--
-- SOMENTE LEITURA: só SELECT, não altera nada.
-- Onde rodar: editor SQL do Neon, no banco de PRODUÇÃO. Copie tudo e execute.
--
-- Por que existe: até o commit que corrigiu o C7, a importação de backup mantinha o id de
-- animal/lote/pasto como vinha no arquivo quando ele não era do próprio backup. Um arquivo
-- adulterado conseguia pendurar pesagens, vacinas e movimentações nos animais de outra conta
-- (elas apareciam na tela da vítima) e colocar animais no lote de outra conta.
--
-- Resultado VAZIO: ninguém usou isso — nada a fazer.
-- Com resultado: cada linha é um registro da conta "dono_registro" ligado a um dado da conta
-- "dono_alvo". São registros intrusos: podem ser apagados (pesagens, vacinas, reprodução,
-- movimentações) ou desvinculados (lote_id / pasto_atual_id = NULL). Revisar antes.
-- ════════════════════════════════════════════════════════════════════════════

SELECT tabela, registro_id, dono_registro, alvo, dono_alvo
FROM (
    SELECT 'pesagens' AS tabela, p.id AS registro_id, p.user_id AS uid_registro,
           'animal ' || a.id AS alvo, a.user_id AS uid_alvo
    FROM pesagens p JOIN animais a ON a.id = p.animal_id WHERE p.user_id <> a.user_id
    UNION ALL
    SELECT 'saudes', s.id, s.user_id, 'animal ' || a.id, a.user_id
    FROM saudes s JOIN animais a ON a.id = s.animal_id WHERE s.user_id <> a.user_id
    UNION ALL
    SELECT 'reproducoes', r.id, r.user_id, 'animal ' || a.id, a.user_id
    FROM reproducoes r JOIN animais a ON a.id = r.animal_id WHERE r.user_id <> a.user_id
    UNION ALL
    SELECT 'movimentacoes', m.id, m.user_id, 'animal ' || a.id, a.user_id
    FROM movimentacoes m JOIN animais a ON a.id = m.animal_id WHERE m.user_id <> a.user_id
    UNION ALL
    SELECT 'movimentacoes (lote)', m.id, m.user_id, 'lote ' || l.id, l.user_id
    FROM movimentacoes m JOIN lotes l ON l.id = m.lote_id WHERE m.user_id <> l.user_id
    UNION ALL
    SELECT 'animais (lote)', a.id, a.user_id, 'lote ' || l.id, l.user_id
    FROM animais a JOIN lotes l ON l.id = a.lote_id WHERE a.user_id <> l.user_id
    UNION ALL
    SELECT 'custos_nutricionais', c.id, c.user_id, 'lote ' || l.id, l.user_id
    FROM custos_nutricionais c JOIN lotes l ON l.id = c.lote_id WHERE c.user_id <> l.user_id
    UNION ALL
    SELECT 'lotes (pasto)', l.id, l.user_id, 'pasto ' || p.id, p.user_id
    FROM lotes l JOIN pastos p ON p.id = l.pasto_atual_id WHERE l.user_id <> p.user_id
    UNION ALL
    SELECT 'historico_ocupacao (lote)', h.id, h.user_id, 'lote ' || l.id, l.user_id
    FROM historico_ocupacao h JOIN lotes l ON l.id = h.lote_id WHERE h.user_id <> l.user_id
    UNION ALL
    SELECT 'historico_ocupacao (pasto)', h.id, h.user_id, 'pasto ' || p.id, p.user_id
    FROM historico_ocupacao h JOIN pastos p ON p.id = h.pasto_id WHERE h.user_id <> p.user_id
) x
JOIN users ur ON ur.id = x.uid_registro
JOIN users ua ON ua.id = x.uid_alvo
CROSS JOIN LATERAL (SELECT ur.email AS dono_registro, ua.email AS dono_alvo) e
ORDER BY tabela, registro_id;
