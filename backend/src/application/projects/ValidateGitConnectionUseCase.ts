/**
 * ValidateGitConnectionUseCase — Valida a conexão com o GitHub via PAT.
 *
 * Chama GET /user na API do GitHub para verificar se o PAT é válido
 * e retorna o login do usuário autenticado.
 *
 * Retorna { connected: false } se o PAT não estiver configurado ou for inválido.
 */

import { Octokit } from '@octokit/rest';
import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';

export interface GitConnectionStatus {
    connected: boolean;
    login?: string;
    name?: string;
    avatarUrl?: string;
}

export class ValidateGitConnectionUseCase {
    constructor(private readonly settingsRepo: ISettingsRepository) { }

    async execute(): Promise<GitConnectionStatus> {
        const settings = await this.settingsRepo.findAll();
        const pat = settings['git_pat']?.trim();

        if (!pat) return { connected: false };

        try {
            const octokit = new Octokit({ auth: pat });
            const { data } = await octokit.users.getAuthenticated();
            return {
                connected: true,
                login: data.login,
                name: data.name ?? undefined,
                avatarUrl: data.avatar_url,
            };
        } catch {
            return { connected: false };
        }
    }
}
