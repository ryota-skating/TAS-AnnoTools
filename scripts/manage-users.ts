#!/usr/bin/env ts-node

/**
 * FS-AnnoTools3 User Management Script
 * ユーザーアカウント管理用スクリプト
 */

import * as readline from 'readline';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../backend/src/services/database';
import { config } from '../backend/src/config/config';

interface User {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: 'Admin' | 'Annotator' | 'Viewer';
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
}

class UserManager {
  private rl: readline.Interface;
  private db: Database;
  private isRlClosed = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.db = Database.getInstance();
  }

  private async question(query: string): Promise<string> {
    return new Promise((resolve) => {
      if (this.isRlClosed) {
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        this.isRlClosed = false;
      }
      this.rl.question(query, resolve);
    });
  }

  private async init(): Promise<void> {
    try {
      await this.db.connect();
      console.log('✅ データベースに接続しました\n');
    } catch (error) {
      console.error('❌ データベース接続エラー:', error);
      process.exit(1);
    }
  }

  private async cleanup(): Promise<void> {
    await this.db.disconnect();
    if (!this.isRlClosed) {
      this.rl.close();
      this.isRlClosed = true;
    }
  }

  // 1. ユーザー登録機能
  private async registerUser(): Promise<void> {
    console.log('\n=== 新規ユーザー登録 ===');
    
    try {
      const name = await this.question('表示名を入力してください: ');
      if (!name.trim()) {
        console.log('❌ 表示名は必須です');
        return;
      }

      const username = await this.question('ユーザー名を入力してください: ');
      if (!username.trim()) {
        console.log('❌ ユーザー名は必須です');
        return;
      }

      // ユーザー名の重複チェック
      const existingUser = await this.db.get(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );

      if (existingUser) {
        console.log('❌ このユーザー名は既に使用されています');
        return;
      }

      const password = await this.question('パスワードを入力してください: ');
      if (!password.trim()) {
        console.log('❌ パスワードは必須です');
        return;
      }

      const email = await this.question('メールアドレス (オプション): ');
      
      console.log('\n役割を選択してください:');
      console.log('1. Admin (管理者)');
      console.log('2. Annotator (注釈者)');
      console.log('3. Viewer (閲覧者)');
      
      const roleChoice = await this.question('選択 (1-3): ');
      let role: 'Admin' | 'Annotator' | 'Viewer';
      
      switch (roleChoice) {
        case '1':
          role = 'Admin';
          break;
        case '2':
          role = 'Annotator';
          break;
        case '3':
          role = 'Viewer';
          break;
        default:
          console.log('❌ 無効な選択です。Annotatorに設定します');
          role = 'Annotator';
          break;
      }

      // パスワードハッシュ化
      const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
      
      // ユーザー作成
      const userId = uuidv4();
      await this.db.run(
        `INSERT INTO users (id, name, username, email, role, password_hash, created_at, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1)`,
        [userId, name, username, email || null, role, passwordHash]
      );

      console.log(`\n✅ ユーザー "${name}" (${username}) を ${role} として登録しました`);
      
    } catch (error) {
      console.error('❌ ユーザー登録エラー:', error);
    }
  }

  // 2. 既存ユーザー一覧表示
  private async listUsers(): Promise<User[]> {
    console.log('\n=== 登録済みユーザー一覧 ===');
    
    try {
      const users = await this.db.all(`
        SELECT id, name, username, email, role, created_at, last_login_at, is_active
        FROM users 
        ORDER BY created_at DESC
      `) as User[];

      if (users.length === 0) {
        console.log('登録されているユーザーはありません');
        return [];
      }

      console.log('\nNo. | ユーザー名     | 表示名           | 役割       | 状態   | 作成日時');
      console.log('----+----------------+------------------+------------+--------+-------------------');
      
      users.forEach((user, index) => {
        const status = user.is_active ? '有効' : '無効';
        const createdAt = new Date(user.created_at).toLocaleDateString('ja-JP');
        
        console.log(
          `${(index + 1).toString().padStart(3)} | ${user.username.padEnd(14)} | ${user.name.padEnd(16)} | ${user.role.padEnd(10)} | ${status.padEnd(6)} | ${createdAt}`
        );
      });

      return users;
      
    } catch (error) {
      console.error('❌ ユーザー一覧取得エラー:', error);
      return [];
    }
  }

  // 3. ユーザー削除機能
  private async deleteUser(): Promise<void> {
    const users = await this.listUsers();
    
    if (users.length === 0) {
      return;
    }

    console.log('\n=== ユーザー削除 ===');
    
    try {
      const choice = await this.question('削除するユーザーの番号を入力してください (キャンセル: 0): ');
      const userIndex = parseInt(choice) - 1;
      
      if (choice === '0') {
        console.log('キャンセルしました');
        return;
      }
      
      if (isNaN(userIndex) || userIndex < 0 || userIndex >= users.length) {
        console.log('❌ 無効な番号です');
        return;
      }

      const targetUser = users[userIndex];
      
      // 管理者が1人だけの場合の削除防止
      if (targetUser.role === 'Admin') {
        const adminCount = await this.db.get(
          'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1',
          ['Admin']
        ) as { count: number };
        
        if (adminCount.count <= 1) {
          console.log('❌ 最後の管理者アカウントは削除できません');
          return;
        }
      }

      const confirm = await this.question(
        `本当にユーザー "${targetUser.name}" (${targetUser.username}) を削除しますか？ (yes/no): `
      );
      
      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('キャンセルしました');
        return;
      }

      // ユーザー削除（関連データも削除）
      await this.db.run('DELETE FROM login_attempts WHERE username = ?', [targetUser.username]);
      await this.db.run('DELETE FROM users WHERE id = ?', [targetUser.id]);
      
      console.log(`✅ ユーザー "${targetUser.name}" (${targetUser.username}) を削除しました`);
      
    } catch (error) {
      console.error('❌ ユーザー削除エラー:', error);
    }
  }

  // メインメニュー
  private async showMenu(): Promise<void> {
    console.log('\n================================');
    console.log('  FS-AnnoTools3 ユーザー管理');
    console.log('================================');
    console.log('1. 新規ユーザー登録');
    console.log('2. ユーザー一覧表示');
    console.log('3. ユーザー削除');
    console.log('4. 終了');
    console.log('================================');
  }

  public async run(): Promise<void> {
    await this.init();
    
    console.log('🎉 FS-AnnoTools3 ユーザー管理スクリプトへようこそ！');
    
    while (true) {
      await this.showMenu();
      const choice = await this.question('選択してください (1-4): ');
      
      switch (choice) {
        case '1':
          await this.registerUser();
          break;
        case '2':
          await this.listUsers();
          break;
        case '3':
          await this.deleteUser();
          break;
        case '4':
          console.log('\n👋 スクリプトを終了します');
          await this.cleanup();
          return;
        default:
          console.log('❌ 無効な選択です。1-4の数字を入力してください');
          break;
      }
      
      // メニュー間の区切り
      await this.question('\nEnterキーを押して続行...');
    }
  }
}

// スクリプト実行
if (require.main === module) {
  const userManager = new UserManager();
  userManager.run().catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}