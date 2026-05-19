/**
 * ngrok-state.ts — Estado compartilhado da URL pública do Ngrok.
 *
 * Resolve a dependência circular entre index.ts e api.ts.
 * O index.ts escreve a URL após o tunnel ser estabelecido.
 * O api.ts lê a URL sem precisar importar o index.ts.
 */

let _ngrokPublicUrl: string | null = null;

export function setNgrokUrl(url: string | null): void {
    _ngrokPublicUrl = url;
}

export function getNgrokUrl(): string | null {
    return _ngrokPublicUrl;
}
