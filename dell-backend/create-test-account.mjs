import { randomUUID } from 'node:crypto';
import { createLogin } from './db-api.mjs';
const email=process.env.JK_TEST_EMAIL;
const password=process.env.JK_TEST_PASSWORD;
if (!process.env.DATABASE_URL || !email || !password) {
  console.error('Missing DATABASE_URL, JK_TEST_EMAIL or JK_TEST_PASSWORD');
  process.exitCode=1;
} else {
  try {
    await createLogin(randomUUID(),email,password);
    console.log('Dell staging account created; no credentials printed.');
    process.exitCode=0;
  } catch(e) {
    console.error('Could not create staging account. Check whether auth-schema.sql is installed and email is unique.');
    process.exitCode=1;
  }
}
