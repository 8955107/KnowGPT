import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@/service/response';
import { authToken } from '@/service/utils/tools';
import { connectRedis } from '@/service/redis';
import { ModelDataStatusEnum } from '@/constants/redis';
import { generateVector } from '@/service/events/generateVector';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { dataId, text, q } = req.body as { dataId: string; text: string; q?: string };
    const { authorization } = req.headers;

    if (!authorization) {
      throw new Error('无权操作');
    }

    if (!dataId) {
      throw new Error('缺少参数');
    }

    // 凭证校验
    const userId = await authToken(authorization);

    const redis = await connectRedis();

    // 校验是否为该用户的数据
    const dataItemUserId = await redis.hGet(dataId, 'userId');
    if (dataItemUserId !== userId) {
      throw new Error('无权操作');
    }

    // 更新
    await redis.sendCommand([
      'HMSET',
      dataId,
      ...(q ? ['q', q, 'status', ModelDataStatusEnum.waiting] : []),
      'text',
      text
    ]);

    if (q) {
      generateVector();
    }

    jsonRes(res);
  } catch (err) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
