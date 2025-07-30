import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly API = 'https://89aff07f540a.ngrok-free.app/api'; // ou ngrok/IP

  constructor(private http: HttpClient) { }

  salvarUsuario(username: string, roomId: string, nome: string) {
    return this.http.post(`${this.API}/usuarios`, { username, roomId, nome });
  }

  buscarUsuarioPorCpf(cpf: string) {
    return this.http.get<any>(`${this.API}/usuarios/${ cpf }`);
  }
}