import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Electricity } from './electricity.component';

describe('Electricity', () => {
  let component: Electricity;
  let fixture: ComponentFixture<Electricity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Electricity],
    }).compileComponents();

    fixture = TestBed.createComponent(Electricity);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
