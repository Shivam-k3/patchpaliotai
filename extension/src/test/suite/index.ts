import * as path from 'path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000,
  });

  mocha.addFile(path.resolve(__dirname, 'extension.test.js'));

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}