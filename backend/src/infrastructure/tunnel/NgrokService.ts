/**
 * NgrokService — Gerencia o tunnel Ngrok para exposição local de webhooks.
 *
 * Responsabilidades:
 *   - Iniciar o tunnel se NGROK_AUTHTOKEN estiver configurado
 *   - Registrar a URL pública no estado compartilhado (ngrok-state.ts)
 *   - Encerrar o tunnel graciosamente
 *
 * Quando usar:
 *   Apenas em ambiente de desenvolvimento local para testar webhooks
 *   de provedores externos (Jira, GitHub, etc.) que precisam de uma URL
 *   pública acessível. Em produção, use um domínio real.
 *
 * Ativação:
 *   Defina NGROK_AUTHTOKEN no .env. Se não estiver definido, o serviço
 *   é desabilitado silenciosamente — sem erro, sem log de aviso excessivo.
 */

import ngrok from '@ngrok/ngrok';
import { logger } from '../../config/logger';
import { setNgrokUrl } from '../../shared/ngrok-state';

const log = logger.child({ module: 'ngrok-service' });

export class NgrokService {
    private listener: Awaited<ReturnType<typeof ngrok.forward>> | null = null;

    /**
     * Inicia o tunnel Ngrok apontando para a porta local especificada.
     *
     * Retorna silenciosamente se NGROK_AUTHTOKEN não estiver configurado.
     * Loga erro mas não lança exceção em caso de falha — o servidor continua
     * funcionando sem o tunnel.
     */
    async start(port: number | string): Promise<void> {
        const authtoken = process.env.NGROK_AUTHTOKEN;

        if (!authtoken) {
            log.info('NGROK_AUTHTOKEN não configurado — tunnel desabilitado.');
            return;
        }

        try {
            this.listener = await ngrok.forward({ addr: port, authtoken });
            const url = this.listener.url();
            setNgrokUrl(url);

            log.info(
                { publicUrl: url, webhookUrl: `${url}/api/webhook` },
                'Tunnel Ngrok ativo',
            );
        } catch (err) {
            log.error({ err }, 'Falha ao iniciar tunnel Ngrok');
            // Não relança — o servidor funciona sem Ngrok
        }
    }

    /**
     * Encerra o tunnel Ngrok graciosamente.
     * Chamado no shutdown do servidor.
     */
    async stop(): Promise<void> {
        if (!this.listener) return;
        try {
            await this.listener.close();
            setNgrokUrl(null);
            log.info('Tunnel Ngrok encerrado');
        } catch (err) {
            log.warn({ err }, 'Falha ao encerrar tunnel Ngrok');
        }
    }
}
