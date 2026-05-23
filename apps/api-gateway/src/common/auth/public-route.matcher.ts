import { Injectable } from '@nestjs/common';
import type { PublicRouteRule } from '../../config/route-config.types';

@Injectable()
export class PublicRouteMatcher {
  isPublic(method: string, path: string, rules: PublicRouteRule[]): boolean {
    return rules.some((rule) => this.matchesRule(method, path, rule));
  }

  matchesRule(method: string, path: string, rule: PublicRouteRule): boolean {
    if (rule.method !== '*' && rule.method !== method.toUpperCase()) return false;
    return this.matchesPath(path, rule.pathPattern);
  }

  matchesPath(path: string, pattern: string): boolean {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }

    return path === pattern;
  }
}

