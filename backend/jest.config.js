/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // Les entités TypeORM utilisent des décorateurs : ts-jest lit tsconfig.json,
  // qui active déjà experimentalDecorators / emitDecoratorMetadata.
  moduleFileExtensions: ['js', 'json', 'ts'],
  clearMocks: true,
};
