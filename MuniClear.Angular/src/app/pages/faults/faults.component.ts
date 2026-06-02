import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core'; 
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import { Router } from '@angular/router'; 
import { ApiService } from '../../services/api.service'; 
import * as signalR from '@microsoft/signalr'; 

declare const L: any; 

@Component({ 
  selector: 'app-faults', 
  standalone: true, 
  imports: [CommonModule, FormsModule], 
  templateUrl: './faults.component.html', 
  styleUrls: ['./faults.component.scss'],
  encapsulation: ViewEncapsulation.None
}) 
export class FaultsComponent implements OnInit, AfterViewInit, OnDestroy { 
  accountId = 1; 
  loading = false; 
  error = ''; 
  success = ''; 
  submitting = false; 

  // Multi-step form step state layout controls
  public step: 'list' | 'report' | 'success' = 'list';
  public isLocatingGps: boolean = false;

  // Map 
  private map: any; 
  private markers: any[] = []; 
  allFaults: any[] = []; 

  // Form (Default fallback map coordinates center on Richards Bay matrix)
  form = { 
    category: 'Water', 
    description: '', 
    phone: '', 
    latitude: -28.7548, 
    longitude: 32.0377 
  }; 
  categories = ['Water', 'Electricity', 'Roads', 'Sewerage', 'Refuse', 'Other']; 

  // Photo state tracking structures
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  base64ImageString: string | null = null;

  // My faults 
  myFaults: any[] = []; 

  // SignalR 
  private hubConnection: signalR.HubConnection | null = null; 
  readonly STATUS_COLORS: Record<string, string> = { 
    Pending: '#ef4444', 
    InProgress: '#f59e0b', 
    Resolved: '#22c55e' 
  }; 

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {} 

  ngOnInit(): void { 
    const id = localStorage.getItem('accountId'); 
    if (!id) { 
      this.router.navigate(['/login']); 
      return; 
    } 
    this.accountId = Number(id); 
    this.form.phone = localStorage.getItem('userPhone') || ''; 
    this.loadFaults(); 
    this.connectSignalR(); 
  } 

  ngAfterViewInit(): void { 
    setTimeout(() => this.initMap(), 300); 
  } 

  ngOnDestroy(): void { 
    this.hubConnection?.stop(); 
    if (this.map) { 
      this.map.remove(); 
      this.map = null; 
    } 
  } 

  initMap(): void { 
    if (!document.getElementById('fault-map')) return; 
    
    // Initialize map frame layer layout
    this.map = L.map('fault-map').setView([this.form.latitude, this.form.longitude], 13); 
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      attribution: '© OpenStreetMap contributors' 
    }).addTo(this.map); 

    // Explicit Leaflet Asset 404 Patch for default marker icon resolutions
    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com',
      iconRetinaUrl: 'https://unpkg.com',
      shadowUrl: 'https://unpkg.com',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;

    // Click map canvas layer manually to drop/override pinpoint coordinate parameters
    this.map.on('click', (e: any) => { 
      this.form.latitude = e.latlng.lat; 
      this.form.longitude = e.latlng.lng; 
      this.updatePinMarker(e.latlng.lat, e.latlng.lng); 
      this.cdr.detectChanges(); 
    }); 

    this.renderFaultMarkers();
    
    // Automatically query high-accuracy hardware array coordinates from user device 
    this.trackUserLiveLocation(); 
  } 

  /**
   * Hardware GPS Tracking Matrix
   */
  private trackUserLiveLocation(): void {
    if (!navigator.geolocation) {
      console.warn('Geolocation array matrix is not supported by this browser interface.');
      return;
    }

    this.isLocatingGps = true;
    this.cdr.detectChanges();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.form.latitude = position.coords.latitude;
        this.form.longitude = position.coords.longitude;
        this.isLocatingGps = false;

        if (this.map) {
          // Adjust camera matrix boundaries dynamically around current user location pin mapping
          this.map.setView([this.form.latitude, this.form.longitude], 16, { animate: true });
          this.updatePinMarker(this.form.latitude, this.form.longitude);
        }
        this.cdr.detectChanges();
      },
      (error) => {
        this.isLocatingGps = false;
        console.warn(`[GPS Engine Intercept Exception]: ${error.message}`);
        this.cdr.detectChanges();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  private pinMarker: any = null; 
  updatePinMarker(lat: number, lng: number): void { 
    if (this.pinMarker) this.map.removeLayer(this.pinMarker); 
    this.pinMarker = L.marker([lat, lng], { 
      icon: L.divIcon({ 
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>', 
        iconSize: [18, 18], 
        iconAnchor: [9, 9], 
        className: '' 
      })
    }).addTo(this.map).bindPopup('Your current location coordinates').openPopup(); 
  } 

  renderFaultMarkers(): void { 
    this.markers.forEach(m => this.map?.removeLayer(m)); 
    this.markers = []; 
    this.allFaults.forEach(f => { 
      if (!f.latitude || !f.longitude) return; 
      const color = this.STATUS_COLORS[f.status] || '#ef4444'; 
      const marker = L.marker([f.latitude, f.longitude], { 
        icon: L.divIcon({ 
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`, 
          iconSize: [14, 14], 
          iconAnchor: [7, 7], 
          className: '' 
        }) 
      }).addTo(this.map) 
        .bindPopup(`<b>${f.category}</b><br>${f.description}<br><small>${f.reference} · ${f.status}</small>`); 
      this.markers.push(marker); 
    }); 
  } 

  loadFaults(): void { 
    this.loading = true; 
    this.api.getAllFaults().subscribe({ 
      next: (faults) => { 
        this.allFaults = faults; 
        this.myFaults = faults.filter(f => f.accountID === this.accountId); 
        this.loading = false; 
        if (this.map) this.renderFaultMarkers(); 
        this.cdr.detectChanges(); 
      }, 
      error: () => { 
        this.loading = false; 
      } 
    }); 
  } 

  public goToReport(): void {
    this.form.description = '';
    this.error = '';
    this.success = '';
    this.selectedFile = null;
    this.previewUrl = null;
    this.base64ImageString = null;
    this.step = 'report';
    
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
        this.trackUserLiveLocation(); // Triggers GPS positioning handshake instantly
      }
    }, 350);
  }

  public onPhotoSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      this.selectedFile = fileList[0]; // Target the single file object directly
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
        this.base64ImageString = reader.result as string; 
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  submit(): void { 
    if (!this.form.description) { 
      this.error = 'Please describe the fault.'; 
      return; 
    } 
    this.submitting = true; 
    this.error = ''; 

    const payload: any = { 
      accountId: this.accountId, 
      category: this.form.category, 
      description: this.form.description, 
      latitude: this.form.latitude, 
      longitude: this.form.longitude, 
      phone: this.form.phone
    };

    // If your backend database schema accepts Base64 strings natively, pass it inside your contract model:
    // payload.photoUrl = this.base64ImageString;

    this.api.logFault(payload).subscribe({ 
      next: (res) => { 
        this.success = `Fault logged successfully. Reference: ${res.reference}`; 
        this.submitting = false; 
        this.form.description = ''; 
        
        this.selectedFile = null;
        this.previewUrl = null;
        this.base64ImageString = null;

        this.step = 'success'; 

        this.loadFaults(); 
        this.cdr.detectChanges(); 
      }, 
      error: (err) => { 
        this.submitting = false; 
        this.error = err?.error?.message || 'Could not log fault.'; 
        this.cdr.detectChanges(); 
      } 
    }); 
  } 

  connectSignalR(): void { 
    this.hubConnection = new signalR.HubConnectionBuilder() 
      .withUrl('http://localhost:5026/paymentHub') 
      .withAutomaticReconnect() 
      .build(); 
    this.hubConnection.on('ReceiveFaultUpdate', () => this.loadFaults()); 
    this.hubConnection.start().catch(e => console.warn('SignalR:', e)); 
  } 

  statusChip(s: string): string { 
    if (s === 'Resolved') return 'chip-success'; 
    if (s === 'InProgress') return 'chip-warning'; 
    return 'chip-danger'; 
  } 

  formatDate(d: string): string { 
    if (!d) return '';
    return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)); 
  } 

  goBack(): void { 
    this.router.navigate(['/dashboard']); 
  } 
}

