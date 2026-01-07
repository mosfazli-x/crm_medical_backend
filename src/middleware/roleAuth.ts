import { FastifyRequest, FastifyReply } from 'fastify';

export const requireRole = (allowedRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {

            await request.jwtVerify();

            const { role } = request.user as { role: string };

            if (!allowedRoles.includes(role)) {
                return reply.status(403).send({ error: 'دسترسی ممنوع — نقش کافی نیست' });
            }
        } catch (err) {
            return reply.status(401).send({ error: 'احراز هویت نامعتبر' });
        }
    };
};