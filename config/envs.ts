import 'dotenv/config';
import * as z from 'zod';

const environmentsSchema = z.object({
  PORT: z.string('La varible PORT es necesaria'),
  DATABASE_URL: z.string('La variable DATABASE_URL es necesaria'),
  JWT_SECRET: z.string('La variable JWT_SECRET es necesaria'),
  JWT_EXPIRES_IN: z.string('La variable JWT_EXPIRES_IN es necesaria'),
  URL: z.string('La variable URL es necesaria'),
});

let enviroments: undefined | z.infer<typeof environmentsSchema> = undefined;

try {
  enviroments = environmentsSchema.parse(process.env);
} catch (error: unknown) {
  if (error instanceof z.ZodError) {
    throw error;
  }
  throw new Error('Unknown error while parsing environment variables');
}

export const envs = {
  port: enviroments.PORT,
  jwtSecret: enviroments.JWT_SECRET,
  databaseUrl: enviroments.DATABASE_URL,
  jwtExpiresIn: enviroments.JWT_EXPIRES_IN,
  url: enviroments.URL,
};
