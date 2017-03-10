import * as dojoDeclare from "dojo/_base/declare";
import * as WidgetBase from "mxui/widget/_WidgetBase";

import * as registry from "dijit/registry";
import * as dojoAspect from "dojo/aspect";
import * as domClass from "dojo/dom-class";

import * as Hammer from "hammerjs";
import { AfterSwipeAction, Direction, HammerSwipeOut, SwipeOutOptions } from "./HammerSwipeOut";

import "./ui/ListViewSwipeOut.css";

class ListViewSwipeOut extends WidgetBase {
    // Properties from Mendix modeler
    targetName: string;
    foregroundName: string;
    transparentOnSwipe: boolean;
    itemEntity: string;
    actionTriggerDelay: number;
    onSwipeActionRight: "disabled" | "showPage" | "callMicroflow";
    onSwipeActionLeft: "disabled" | "showPage" | "callMicroflow";
    onSwipeMicroflowLeft: string;
    onSwipeMicroflowRight: string;
    onSwipePageLeft: string;
    onSwipePageRight: string;
    afterSwipeActionRight: AfterSwipeAction;
    afterSwipeActionLeft: AfterSwipeAction;
    backgroundNameRight: string;
    backgroundNameLeft: string;
    afterSwipeBackgroundNameRight: string;
    afterSwipeBackgroundNameLeft: string;

    private swipeClass: string;
    private targetWidget: any;
    private targetNode: HTMLElement;
    private contextObject: mendix.lib.MxObject;

    postCreate() {
        this.swipeClass = "swipe-listview-out";
        this.targetNode = this.findTargetNode(this.targetName);
        if (this.validateConfig()) {
            this.targetWidget = registry.byNode(this.targetNode);
            domClass.add(this.targetNode, this.swipeClass);
        }
    }

    update(contextObject: mendix.lib.MxObject, callback?: () => void) {
        if (this.targetWidget) {
            this.contextObject = contextObject;
            let direction: Direction | "horizontal";
            if (this.onSwipeActionRight !== "disabled" && this.onSwipeActionLeft !== "disabled") {
                direction = "horizontal";
            } else if (this.onSwipeActionRight !== "disabled") {
                direction = "right";
            } else if (this.onSwipeActionLeft !== "disabled") {
                direction = "left";
            }

            if (direction) {
                const swipeOutOptions: SwipeOutOptions = {
                    afterSwipeActionLeft: this.afterSwipeActionLeft,
                    afterSwipeActionRight: this.afterSwipeActionRight,
                    afterSwipeBackgroundNameLeft: this.afterSwipeBackgroundNameLeft,
                    afterSwipeBackgroundNameRight: this.afterSwipeBackgroundNameRight,
                    backgroundNameLeft: this.backgroundNameLeft,
                    backgroundNameRight: this.backgroundNameRight,
                    callback: (element, swipeDirection) => this.handleSwipe(element, swipeDirection),
                    callbackDelay: this.actionTriggerDelay,
                    foregroundName: this.foregroundName,
                    swipeDirection: direction,
                    transparentOnSwipe: this.transparentOnSwipe
                };

                dojoAspect.after(this.targetWidget, "_renderData", () => {
                    try {
                        Hammer.each(this.targetNode.querySelectorAll(".mx-listview-item"), (container: HTMLElement) => {
                            new HammerSwipeOut(container, swipeOutOptions);
                        }, this);
                    } catch (error) {
                        window.mx.ui.error(error.message, true);
                    }

                });
            }
        }

        if (callback) callback();
    }

    private findTargetNode(name: string): HTMLElement {
        let queryNode = this.domNode.parentNode as Element;
        let targetNode: HTMLElement;
        while (!targetNode) {
            targetNode = queryNode.querySelector(".mx-name-" + name) as HTMLElement;
            if (window.document.isEqualNode(queryNode)) { break; }
            queryNode = queryNode.parentNode as HTMLElement;
        }
        return targetNode;
    }

    private validateConfig(): boolean {
        if (!this.targetNode) {
            window.mx.ui.error(`Listview swipe out: unable to find listview with the name "${this.targetName}"`);
            return false;
        }
        this.targetWidget = registry.byNode(this.targetNode);
        if (!this.targetWidget || this.targetWidget.declaredClass !== "mxui.widget.ListView") {
            window.mx.ui.error(`Listview swipe out: configuration target name "${this.targetName}" 
            is not of the type listview`);
            return false;
        }
        if (this.targetWidget._renderData === undefined || this.targetWidget.datasource === undefined ||
            this.targetWidget.datasource.path === undefined) {

            window.mx.ui.error("Listview swipe out: this Mendix version is not compatible", true);
            window.logger.error("mxui.widget.ListView does not have a _renderData function or or .datasource.path");
            return false;
        }
        const segments = this.targetWidget.datasource.path.split("/");
        const listEntity = segments.length ? segments[segments.length - 1] : "";
        if (listEntity !== this.itemEntity) {
            window.mx.ui.error(`Listview swipe out: configuration entity ${this.itemEntity} does not 
            match the listview entity ${listEntity} of ${this.targetName}`, true);
            return false;
        }
        if (this.onSwipeActionRight === "callMicroflow" && !this.onSwipeMicroflowRight) {
            window.mx.ui.error("Listview swipe out: no right microflow is setup", true);
            return false;
        }
        if (this.onSwipeActionLeft === "callMicroflow" && !this.onSwipeMicroflowLeft) {
            window.mx.ui.error("Listview swipe out: no left microflow is setup", true);
            return false;
        }
        if (this.onSwipeActionRight === "showPage" && !this.onSwipePageRight) {
            window.mx.ui.error("Listview swipe out: no right page is setup", true);
            return false;
        }
        if (this.onSwipeActionLeft === "showPage" && !this.onSwipePageLeft) {
            window.mx.ui.error("Listview swipe out: no left page is setup", true);
            return false;
        }
        if (this.onSwipeActionLeft === "disabled" && this.onSwipeActionRight === "disabled") {
            window.mx.ui.error("Listview swipe out: no swipe action left or right selected", true);
            return false;
        }
        return true;
    }

    private handleSwipe(element: HTMLElement, direction: Direction) {
        const guid = registry.byNode(element).getGuid();
        const context = this.createContext(guid);
        this.callMicroflow(direction, context);
        this.showPage(direction, context);
    }

    private callMicroflow(direction: Direction, context: mendix.lib.MxContext) {
        const microflowRight = direction === "right" && this.onSwipeActionRight === "callMicroflow"
            ? this.onSwipeMicroflowRight : "";
        const microflowLeft = direction === "left" && this.onSwipeActionLeft === "callMicroflow"
            ? this.onSwipeMicroflowLeft : "";
        const microflow = microflowRight || microflowLeft;

        if (microflow) {
            window.mx.ui.action(microflow, {
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while executing action ${microflow}: ${error.message}`, true)
            });
        }
    }

    private showPage(direction: Direction, context: mendix.lib.MxContext) {
        const pageRight = direction === "right" && this.onSwipeActionRight === "showPage"
            ? this.onSwipePageRight : "";
        const pageLeft = direction === "left" && this.onSwipeActionLeft === "showPage"
            ? this.onSwipePageLeft : "";
        const page = pageRight || pageLeft;

        if (page) {
            window.mx.ui.openForm(page, {
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while opening form ${page} : ${error.message}`)
            });
        }
    }

    private createContext(guid: string): mendix.lib.MxContext {
        const context = new mendix.lib.MxContext();
        context.setContext(this.itemEntity, guid);
        return context;
    }
}

// Declare widget prototype the Dojo way
// Thanks to https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/dojo/README.md
// tslint:disable : only-arrow-functions
dojoDeclare("com.mendix.widget.ListViewSwipeOut.ListViewSwipeOut", [ WidgetBase ], function(Source: any) {
    const result: any = {};
    for (const property in Source.prototype) {
        if (property !== "constructor" && Source.prototype.hasOwnProperty(property)) {
            result[property] = Source.prototype[property];
        }
    }
    return result;
}(ListViewSwipeOut));
