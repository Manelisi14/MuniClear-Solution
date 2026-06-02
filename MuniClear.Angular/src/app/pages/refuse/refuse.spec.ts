import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Refuse } from './refuse.component';

describe('Refuse', () => {
  let component: Refuse;
  let fixture: ComponentFixture<Refuse>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Refuse],
    }).compileComponents();

    fixture = TestBed.createComponent(Refuse);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
