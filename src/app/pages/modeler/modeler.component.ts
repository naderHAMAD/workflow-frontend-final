import { DialogWorkflowComponent } from '../dialog/dialog-workflow/dialog-workflow.component';
import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Workflow } from 'src/app/entities/Workflow.entity';
import { WorkflowService } from 'src/app/services/workflow.service';
import { Subscription } from 'rxjs';

import BpmnModeler from 'bpmn-js/lib/Modeler';
import Swal from 'sweetalert2';

// Importez les modules nécessaires pour bpmn-js
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';


@Component({
  selector: 'app-modeler',
  templateUrl: './modeler.component.html',
  styleUrls: ['./modeler.component.css']
})
export class ModelerComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvasRef: ElementRef;

  private bpmnModeler: BpmnModeler;
  private workflow: Workflow;
  isUpdate: boolean;
  dialogOpen: boolean = false;

  private subscriptions: Subscription[] = [];

  constructor(
    public dialog: MatDialog,
    private workflowService: WorkflowService,
  ) {}

  ngOnInit() {
    this.bpmnModeler = new BpmnModeler({
      container: this.canvasRef.nativeElement,
      // Configuration pour bpmn-js avec le panneau des propriétés
      propertiesPanel: {
        parent: '#properties'
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule
      ]
    });

    this.workflow = history.state.workflow;
    this.isUpdate = history.state.isUpdate ?? false;

    if (this.workflow) {
      this.loadWorkflow();
    } else {
      this.createNewWorkflow();
    }
  }

  async loadWorkflow() {
    try {
      const workflow = await this.workflowService.getWorkflow(this.workflow.id).toPromise();
      const xml = workflow.xmlContent; // Assuming the XML content property name is xmlContent
            await this.bpmnModeler.importXML(xml);
      this.zoomToFit();
    } catch (err) {
      console.error(err);
    }
  }

  createNewWorkflow() {
    this.bpmnModeler.createDiagram().then(() => {
      this.zoomToFit();
    }).catch((error) => {
      console.error('Error creating diagram', error);
    });
  }

  zoomToFit() {
    const canvas: any = this.bpmnModeler.get('canvas'); // Explicitly type canvas as any
    canvas.zoom('fit-viewport');
  }

  async onSaveClick() {
    if (this.dialogOpen) {
      return; // Do nothing if the dialog is already open
    }
    this.dialogOpen = true;
    const dialogRef = this.dialog.open(DialogWorkflowComponent, {
      data: { workflowName: '', xmlName: '' }
    });
    try {
      const result = await dialogRef.afterClosed().toPromise();
      this.dialogOpen = false; // Set the flag to false when the dialog is closed
      if (result) {
        const { xml } = await this.bpmnModeler.saveXML({ format: true });
        // Modify the XML string to set the isExecutable attribute to true
        const uniqueId = Math.floor(Math.random() * 10000);
        const modifiedXml = xml.replace('id="Process_1" isExecutable="false"', `id="Process_${uniqueId}" isExecutable="true"`);
        const modifiedXml2 = modifiedXml.replace('bpmnElement="Process_1" id="BPMNPlane_1"', `bpmnElement="Process_${uniqueId}" id="BPMNPlane_1"`);
        const workflow: Workflow = {
          name: result.workflowName,
          xmlContent: modifiedXml2,
          xmlName: result.xmlName + '.bpmn',
          deploymentId: '',
          id: ''
        };
        const savedWorkflow = await this.workflowService.saveWorkflow(workflow).toPromise();
        console.log('Workflow saved:', savedWorkflow);
        Swal.fire({
          position: 'center',
          icon: 'success',
          title: 'The BPMN was saved successfully!',
          showConfirmButton: false,
          timer: 1500
        });
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      if (error.error && error.error.message) {
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: error.error.message,
          showConfirmButton: false,
          timer: 1500
        });
      } else {
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: 'An error occurred while saving the workflow.',
          showConfirmButton: false,
          timer: 2500
        });
      }
    }
  }

  async onUpdateClick(): Promise<void> {
    if (!this.workflow) {
      console.error('Workflow not found.');
      return;
    }

    try {
      const { xml } = await this.bpmnModeler.saveXML({ format: true });
      this.workflow.xmlContent = xml;
      const updatedWorkflow = await this.workflowService.updateWorkflow(this.workflow).toPromise();
      console.log('Workflow saved:', updatedWorkflow);
      Swal.fire({
        position: 'center',
        icon: 'success',
        title: 'The BPMN is updated successfully!',
        html: 'NOTE: now you can start the <i>latest</i> version of the process',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (error) {
      console.error('Error saving workflow:', error);
      if (error.error && error.error.message) {
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: error.error.message,
          showConfirmButton: false,
          timer: 1500
        });
      } else {
        Swal.fire({
          position: 'center',
          icon: 'error',
          title: 'An error occurred while saving the workflow.',
          showConfirmButton: false,
          timer: 2500
        });
      }
    }
  }
 
  
  
  onImportClick(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bpmn, .xml';

    input.onchange = async (event: Event) => {
      const file = (event.target as HTMLInputElement).files[0];
      if (!file) return;

      try {
        const xml = await file.text();
        await this.bpmnModeler.importXML(xml);
        this.zoomToFit();
      } catch (err) {
        console.error(err);
      }
    };
    input.click();
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions to prevent memory leaks
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    if (this.bpmnModeler) {
      this.bpmnModeler.destroy();
    }
    if (this.dialog.openDialogs.length) {
      this.dialog.closeAll();
    }
  }
}

