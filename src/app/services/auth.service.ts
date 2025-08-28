import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'https://eb0a1034471b.ngrok-free.app'; // ngrok ou IP local

  constructor(private http: HttpClient) {}

  login(username: string, roomId: string) {
    return this.http.post(`${this.API_URL}/login`, { username, roomId });
  }
}