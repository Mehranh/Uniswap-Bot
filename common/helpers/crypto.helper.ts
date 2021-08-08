const crypto = require('crypto');
export class CryptoHelper {
  private static algorithm = 'aes-256-ctr';
  private static secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';
  private static iv = crypto.randomBytes(16);

 static encrypt(text) {
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, this.iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
      iv: this.iv.toString('hex'),
      content: encrypted.toString('hex'),
    };
  };

  static decrypt(iv,content) {

    const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, Buffer.from(iv, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]);

    return decrpyted.toString();
  };

}
