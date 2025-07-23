import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionRoomPage } from './session-room.page';

describe('SessionRoomPage', () => {
  let component: SessionRoomPage;
  let fixture: ComponentFixture<SessionRoomPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionRoomPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
