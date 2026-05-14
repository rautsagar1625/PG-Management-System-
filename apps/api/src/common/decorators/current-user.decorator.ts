import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { RequestContext } from '@pg-system/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestContext;
  },
);
