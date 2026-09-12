import bcrypt from "bcryptjs";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  emailVerified: boolean;
  pinFailedAttempts: number;
  pinLockedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserSecurity {
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    return bcrypt.hash(password, 10);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async hashPin(pin: string): Promise<string> {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error("PIN must be 4 to 6 numeric digits");
    }
    return bcrypt.hash(pin, 8);
  }

  static async verifyPin(
    pin: string,
    hash: string,
    currentAttempts: number,
    lockedUntil?: Date | null
  ): Promise<{
    valid: boolean;
    locked: boolean;
    remainingAttempts: number;
    lockoutExpiresAt?: Date;
  }> {
    const now = new Date();

    // Check existing lockout
    if (lockedUntil && lockedUntil > now) {
      return {
        valid: false,
        locked: true,
        remainingAttempts: 0,
        lockoutExpiresAt: lockedUntil,
      };
    }

    const isMatch = await bcrypt.compare(pin, hash);

    if (isMatch) {
      return {
        valid: true,
        locked: false,
        remainingAttempts: 5,
      };
    }

    const nextAttempts = currentAttempts + 1;
    const maxAttempts = 5;

    if (nextAttempts >= maxAttempts) {
      // 15-minute lock
      const expires = new Date(now.getTime() + 15 * 60 * 1000);
      return {
        valid: false,
        locked: true,
        remainingAttempts: 0,
        lockoutExpiresAt: expires,
      };
    }

    return {
      valid: false,
      locked: false,
      remainingAttempts: maxAttempts - nextAttempts,
    };
  }
}
