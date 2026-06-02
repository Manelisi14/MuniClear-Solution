import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Faults } from './faults';

describe('Faults', () => {
  let component: Faults;
  let fixture: ComponentFixture<Faults>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Faults],
    }).compileComponents();

    fixture = TestBed.createComponent(Faults);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
