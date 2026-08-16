import type { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

interface ValueProvider {
  provide: Type<unknown>;
  useValue: unknown;
}

export async function resolveService<TService extends Type<unknown>>(
  service: TService,
  providers: ValueProvider[],
): Promise<InstanceType<TService>> {
  const module = await Test.createTestingModule({
    providers: [service, ...providers],
  }).compile();
  return module.get<InstanceType<TService>>(service);
}
