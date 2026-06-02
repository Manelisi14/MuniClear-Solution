import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Airtime } from './airtime.component';

describe('Airtime', () => {
  let component: Airtime;
  let fixture: ComponentFixture<Airtime>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Airtime],
    }).compileComponents();

    fixture = TestBed.createComponent(Airtime);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
