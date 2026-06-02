import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rates } from './rates.component';

describe('Rates', () => {
  let component: Rates;
  let fixture: ComponentFixture<Rates>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rates],
    }).compileComponents();

    fixture = TestBed.createComponent(Rates);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
