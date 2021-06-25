import { Injectable } from '@nestjs/common';
import { get } from 'needle';
import * as manager from 'node-selectel-manager';

@Injectable()
export class StorageService {
  storage: string;
  private defaultDirectory: string;
  options: { password: string; login: string };

  constructor() {
    this.storage = process.env.STORAGE_NAME;
    this.defaultDirectory = `images`;
    this.options = {
      login: process.env.STORAGE_LOGIN,
      password: process.env.STORAGE_PASSWORD,
    };
  }

  async uploadFile(url, directory = this.defaultDirectory) {
    try {
      const fileUrl = url.indexOf('https') !== -1 ? url : 'https:' + url;

      if (fileUrl.indexOf('https') !== -1) {
        const storage = this.storage;
        const managerOptions = this.options;
        const httpOptions = {};
        const fileName = fileUrl.split('/').pop();

        get(fileUrl, httpOptions, function (err, response) {
          if (err || response.statusCode !== 200) return false;
          if (response.body && fileName) {
            manager(managerOptions).uploadFile(
              response.body,
              `${storage}/${directory}/${fileName}`,
            );
          }
        });
      }
    } catch (e) {
      console.log(e);
    }
  }
}
