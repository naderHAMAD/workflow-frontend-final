import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, Subscription} from 'rxjs';

import Modeler from "bpmn-js/lib/Modeler";
import propertiesPanelModule from "bpmn-js-properties-panel";
import propertiesProviderModule from "bpmn-js-properties-panel/lib/provider/camunda";
import BpmnModeler from 'bpmn-js/lib/Modeler';

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import "bpmn-js-properties-panel/dist/assets/bpmn-js-properties-panel.css";

import * as camundaModdleDescriptor from 'camunda-bpmn-moddle/resources/camunda.json';
import Swal from 'sweetalert2';
import { DialogWorkflowComponent } from '../dialog/dialog-workflow/dialog-workflow.component';
import { Workflow } from 'src/app/entities/Workflow.entity';
import { MatDialog } from '@angular/material/dialog';
import { WorkflowService } from 'src/app/services/workflow.service';
import { SaveXMLResult } from 'bpmn-js/lib/BaseViewer';

@Component({
  selector: 'app-designer',
  templateUrl: './designer.component.html',
  styleUrls: ['./designer.component.css']
})
export class DesignerComponent implements OnInit {
  title = 'Workflow Modeler';
  modeler: Modeler;

  @ViewChild('canvas')
  private canvesRef: ElementRef;
  private bpmnModeler: BpmnModeler;
  private workflow: Workflow;
  isUpdate: boolean;
  dialogOpen: boolean = false;

  private subscriptions: Subscription[] = [];
  constructor(private http: HttpClient,   public dialog: MatDialog,
    private workflowService: WorkflowService,) {
 
  }

  ngOnInit(): void {
    this.modeler = new Modeler({
      container: '#canvas',
      width: '100%',
      height: '600px',
      propertiesPanel: {
        parent: '#properties'
      },
      additionalModules: [
        propertiesPanelModule,
        propertiesProviderModule
      ],
      moddleExtensions: {
        camunda: camundaModdleDescriptor
      }
    });
    
    this.load();
  }

  load(): void {
    this.getExample().subscribe(data => {
      this.modeler.importXML(data, value => this.handleError(value));
    });
  }

  handleError(err: any) {
    if (err) {
      console.warn('Ups, error: ', err);
    }
  }

  public getExample(): Observable<string> {
    const url = '/assets/bpmn2/initial.bpmn'; // local
    return this.http.get(url, {responseType: 'text'});
  }


  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const xmlContent = e.target?.result as string;
        this.importDiagram(xmlContent);
      };
      reader.readAsText(file);
    }
  }

  importDiagram(xmlContent: string): void {
    this.modeler.importXML(xmlContent, (err) => {
      if (err) {
        console.error('Erreur lors de l\'importation du diagramme :', err);
      } else {
        console.log('Diagramme importé avec succès.');
      }
    });
  }
///////////////////////////////////
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
      const { xml } = await this.modeler.saveXML({ format: true });
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
//////////////////////////////////////////////
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
zoomToFit() {
  const canvas: any = this.modeler.get('canvas'); // Explicitly type canvas as any
  canvas.zoom('fit-viewport');
}
///////////////////////////////////////////////////////
async onUpdateClick(): Promise<void> {
  if (!this.workflow) {
    console.error('Workflow not found.');
    return;
  }

  try {
    const { xml } = await this.modeler.saveXML({ format: true });
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
/////////////////////////////////////
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
/////////////////////////////////////////////////
onDownloadClick(): void {
  this.bpmnModeler.saveXML({ format: true })
    .then((result: SaveXMLResult) => {
      const xml: string = result.xml; // Adjust this line based on the actual structure of SaveXMLResult
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.download = 'process.bpmn';
      anchor.href = url;
      anchor.click();
      window.URL.revokeObjectURL(url);
    })
    .catch((err: any) => {
      console.error(err);
    });
}


}
