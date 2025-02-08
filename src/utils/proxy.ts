export interface Proxy {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export class ProxyRotator {
  private proxies: Proxy[];
  private currentIndex: number = 0;

  constructor(proxies: Proxy[]) {
    this.proxies = proxies;
  }

  getNext(): Proxy {
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }

  getProxyString(proxy: Proxy): string {
    if (proxy.username && proxy.password) {
      return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }
    return `http://${proxy.host}:${proxy.port}`;
  }
} 