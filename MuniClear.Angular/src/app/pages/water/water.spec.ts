import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Water } from './water.component';

describe('Water', () => {
  let component: Water;
  let fixture: ComponentFixture<Water>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Water],
    }).compileComponents();

    fixture = TestBed.createComponent(Water);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
