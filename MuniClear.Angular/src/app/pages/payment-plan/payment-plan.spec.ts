import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentPlan } from './payment-plan';

describe('PaymentPlan', () => {
  let component: PaymentPlan;
  let fixture: ComponentFixture<PaymentPlan>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentPlan],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentPlan);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
