'use strict';

define(['app'], function (app) {
    app.$controllerProvider.register('NodeController', function ($rootScope, $scope, $state, $stateParams, $location, $anchorScroll, $mdDialog, ConfigService, NodeService, NotebookService, OpenResponseService, ProjectService, SessionService, StudentAssetService, StudentDataService) {

        // the auto save interval in milliseconds
        this.autoSaveInterval = 60000;

        // the node id of the current node
        this.nodeId = null;

        // field that will hold the node content
        this.nodeContent = null;

        // field that will hold the node status
        this.nodeStatus = null;

        // field that will hold the node title
        this.nodeTitle = null;

        // whether the student work is dirty and needs saving
        this.isDirty = false;

        this.workgroupId = ConfigService.getWorkgroupId();

        this.teacherWorkgroupId = ConfigService.getTeacherWorkgroupId();

        /*
         * an object that holds the mappings with the key being the component
         * and the value being the scope object from the child controller
         */
        $scope.componentToScope = {};
        this.notebookOpen = false;

        this.saveMessage = {
            text: '',
            time: ''
        };

        /**
         * Perform setup of the node
         */
        this.setup = function () {
            // get the current node and node id
            var currentNode = StudentDataService.getCurrentNode();
            if (currentNode != null) {
                this.nodeId = currentNode.id;
            }

            // save nodeEntered event
            var nodeId = this.nodeId;
            var componentId = null;
            var componentType = null;
            var category = "Navigation";
            var event = "nodeEntered";
            var eventData = {};
            eventData.nodeId = nodeId;
            StudentDataService.saveVLEEvent(nodeId, componentId, componentType, category, event, eventData);

            // get the node content
            this.nodeContent = ProjectService.getNodeContentByNodeId(this.nodeId);

            this.nodeTitle = ProjectService.getNodeTitleByNodeId(this.nodeId);

            this.nodeStatus = StudentDataService.nodeStatuses[this.nodeId];

            // populate the student work into this node
            //this.setStudentWork();

            // check if we need to lock this node
            this.calculateDisabled();

            //this.importWork();

            // tell the parent controller that this node has loaded
            //this.nodeLoaded(this.nodeId);

            // start the auto save interval
            this.startAutoSaveInterval();

            // register this controller to listen for the exit event
            this.registerExitListener();

            if (NodeService.hasTransitionLogic() && NodeService.evaluateTransitionLogicOn('enterNode')) {
                NodeService.evaluateTransitionLogic();
            }

            //console.log(ProjectService.getBranches());
        };

        /**
         * Populate the student work into the node
         */
        this.setStudentWork = function () {};

        /**
         * Import work from another node
         */
        this.importWork = function () {};

        /**
         * Returns all the revisions made by this user for the specified component
         */
        this.getRevisions = function (componentId) {
            var revisions = [];
            // get the component states for this component
            var componentStates = StudentDataService.getComponentStatesByNodeIdAndComponentId(this.nodeId, componentId);
            return componentStates;
        };

        this.showRevisions = function ($event, componentId, isComponentDisabled) {
            var revisions = this.getRevisions(componentId);
            var allowRevert = !isComponentDisabled;

            // get the scope for the component
            var childScope = $scope.componentToScope[componentId];

            // TODO: generalize for other controllers
            var componentController = null;

            if (childScope.openResponseController) {
                componentController = childScope.openResponseController;
            } else if (childScope.drawController) {
                componentController = childScope.drawController;
            }

            // broadcast showRevisions event
            $rootScope.$broadcast('showRevisions', { revisions: revisions, componentController: componentController, allowRevert: allowRevert, $event: $event });
        };

        this.showNotebook = function ($event, componentId) {

            // get the scope for the component
            var childScope = $scope.componentToScope[componentId];

            // TODO: generalize for other controllers
            var componentController = null;

            if (childScope.openResponseController) {
                componentController = childScope.openResponseController;
            } else if (childScope.drawController) {
                componentController = childScope.drawController;
            } else if (childScope.discussionController) {
                componentController = childScope.discussionController;
            } else if (childScope.tableController) {
                componentController = childScope.tableController;
            } else if (childScope.graphController) {
                componentController = childScope.graphController;
            }

            // TODO: support filtering by notebook item type/filetype
            var notebookFilters = [{ 'name': 'files', 'label': 'Files' }];

            $rootScope.$broadcast('showNotebook', { componentController: componentController, notebookFilters: notebookFilters, $event: $event });
        };

        /**
         * Called when the student clicks the save button
         */
        this.saveButtonClicked = function () {

            // notify the child components that the save button was clicked
            $rootScope.$broadcast('nodeSaveClicked', { nodeId: this.nodeId });

            var isAutoSave = false;

            /*
             * obtain the component states from the children and save them
             * to the server
             */
            this.createAndSaveComponentData(isAutoSave);
        };

        /**
         * Called when the student clicks the submit button
         */
        this.submitButtonClicked = function () {

            // notify the child components that the submit button was clicked
            $rootScope.$broadcast('nodeSubmitClicked', { nodeId: this.nodeId });

            var isAutoSave = false;

            /*
             * obtain the component states from the children and save them
             * to the server
             */
            this.createAndSaveComponentData(isAutoSave);
        };

        /**
         * Check if we need to lock the node
         */
        this.calculateDisabled = function () {

            var nodeId = this.nodeId;

            // get the node content
            var nodeContent = this.nodeContent;

            if (nodeContent) {
                var lockAfterSubmit = nodeContent.lockAfterSubmit;

                if (lockAfterSubmit) {
                    // we need to lock the step after the student has submitted

                    // get the component states for the node
                    var componentStates = StudentDataService.getComponentStatesByNodeId(nodeId);

                    // check if any of the component states were submitted
                    var isSubmitted = NodeService.isWorkSubmitted(componentStates);

                    if (isSubmitted) {
                        // the student has submitted work for this node
                        this.isDisabled = true;
                    }
                }
            }
        };

        /**
         * Get the components for this node.
         * @return an array that contains the content for the components
         */
        this.getComponents = function () {
            var components = null;

            if (this.nodeContent != null) {
                components = this.nodeContent.components;
            }

            if (components != null && this.isDisabled) {
                for (var c = 0; c < components.length; c++) {
                    var component = components[c];

                    component.isDisabled = true;
                }
            }

            if (components != null && this.nodeContent.lockAfterSubmit) {
                for (c = 0; c < components.length; c++) {
                    component = components[c];

                    component.lockAfterSubmit = true;
                }
            }

            return components;
        };

        /**
         * Get the component given the component id
         * @param componentId the component id we want
         * @return the component object with the given component id
         */
        this.getComponentById = function (componentId) {

            var component = null;

            if (componentId != null) {

                // get all the components
                var components = this.getComponents();

                // loop through all the components
                for (var c = 0; c < components.length; c++) {

                    // get a component
                    var tempComponent = components[c];

                    if (tempComponent != null) {
                        var tempComponentId = tempComponent.id;

                        // check if the component id matches the one we want
                        if (tempComponentId === componentId) {
                            // the component id matches
                            component = tempComponent;
                            break;
                        }
                    }
                }
            }

            return component;
        };

        /**
         * Check if this node contains a given component id
         * @param componentId the component id
         * @returns whether this node contains the component
         */
        this.nodeContainsComponent = function (componentId) {
            var result = false;

            if (componentId != null) {

                // get all the components
                var components = this.getComponents();

                // loop through all the components
                for (var c = 0; c < components.length; c++) {

                    // get a component
                    var tempComponent = components[c];

                    if (tempComponent != null) {
                        var tempComponentId = tempComponent.id;

                        // check if the component id matches the one we want
                        if (tempComponentId === componentId) {
                            // the component id matches
                            result = true;
                            break;
                        }
                    }
                }
            }

            return result;
        };

        /**
         * Get the html template for the component
         * @param componentType the component type
         * @return the path to the html template for the component
         */
        this.getComponentTemplatePath = function (componentType) {
            return NodeService.getComponentTemplatePath(componentType);
        };

        /**
         * Check whether we need to show the save button
         * @return whether to show the save button
         */
        this.showSaveButton = function () {
            var result = false;

            if (this.nodeContent != null && this.nodeContent.showSaveButton) {
                result = true;
            }

            return result;
        };

        /**
         * Check whether we need to show the submit button
         * @return whether to show the submit button
         */
        this.showSubmitButton = function () {
            var result = false;

            if (this.nodeContent != null && this.nodeContent.showSubmitButton) {
                result = true;
            }

            return result;
        };

        /**
         * Check whether we need to lock the component after the student
         * submits an answer.
         */
        this.isLockAfterSubmit = function () {
            var result = false;

            if (this.componentContent != null) {

                // check the lockAfterSubmit field in the component content
                if (this.componentContent.lockAfterSubmit) {
                    result = true;
                }
            }

            return result;
        };

        /**
         * Set the message next to the save button
         * @param message the message to display
         */
        this.setSaveMessage = function (message) {
            this.saveMessage.text = message;
            this.saveMessage.time = new Date();
        };

        /**
         * Start the auto save interval for this node
         */
        this.startAutoSaveInterval = function () {
            this.autoSaveIntervalId = setInterval(angular.bind(this, function () {
                // check if the student work is dirty
                if (this.isDirty) {
                    // the student work is dirty so we will save

                    var isAutoSave = true;

                    /*
                     * obtain the component states from the children and save them
                     * to the server
                     */
                    this.createAndSaveComponentData(isAutoSave);
                    //this.setSaveMessage('Auto-Saved');
                }
            }), this.autoSaveInterval);
        };

        /**
         * Stop the auto save interval for this node
         */
        this.stopAutoSaveInterval = function () {
            clearInterval(this.autoSaveIntervalId);
        };

        /**
         * Obtain the componentStates and annotations from the children and save them
         * to the server
         * @param isAutoSave whether the component states were auto saved
         * @param componentId (optional) the component id of the component
         * that triggered the save
         */
        this.createAndSaveComponentData = function (isAutoSave, componentId) {

            // obtain the component states from the children
            var componentStates = this.createComponentStates(isAutoSave, componentId);
            var componentAnnotations = this.getComponentAnnotations();
            var componentEvents = null;
            var nodeStates = null;

            if (ConfigService.getConfigParam('mode') === 'preview') {
                // we are in preview mode so we will pretend that the data was saved to the server

                this.isDirty = false;

                if (isAutoSave) {
                    this.setSaveMessage('Auto-Saved');
                } else {
                    this.setSaveMessage('Saved');
                }
            }

            if (componentStates != null && componentStates.length > 0 || componentAnnotations != null && componentAnnotations.length > 0 || componentEvents != null && componentEvents.length > 0) {
                // save the component states to the server
                return StudentDataService.saveToServer(componentStates, nodeStates, componentEvents, componentAnnotations).then(angular.bind(this, function (savedStudentDataResponse) {
                    // check if this node has transition logic that should be run when the student data changes
                    if (NodeService.hasTransitionLogic() && NodeService.evaluateTransitionLogicOn('studentDataChanged')) {
                        // this node has transition logic
                        NodeService.evaluateTransitionLogic();
                    }

                    // TODO: handle error response from server if POST fails
                    this.isDirty = false;

                    if (isAutoSave) {
                        this.setSaveMessage('Auto-Saved');
                    } else {
                        this.setSaveMessage('Saved');
                    }

                    return savedStudentDataResponse;
                }));
            }
        };

        /**
         * Loop through this node's components and get/create component states
         * @param isAutoSave whether the component states were auto saved
         * @param componentId (optional) the component id of the component
         * that triggered the save
         * @returns an array of component states
         */
        this.createComponentStates = function (isAutoSave, componentId) {
            var componentStates = [];

            // get the components for this node
            var components = this.getComponents();

            if (components != null) {

                var runId = ConfigService.getRunId();
                var periodId = ConfigService.getPeriodId();
                var workgroupId = ConfigService.getWorkgroupId();

                // loop through all the components
                for (var c = 0; c < components.length; c++) {

                    // get a component
                    var component = components[c];

                    if (component != null) {
                        // get the component id
                        var tempComponentId = component.id;

                        // get the scope for the component
                        var childScope = $scope.componentToScope[tempComponentId];

                        if (childScope != null) {
                            var componentState = null;

                            if (childScope.getComponentState != null) {
                                // get the student work object from the child scope
                                componentState = childScope.getComponentState();
                            }

                            if (componentState != null) {

                                componentState.runId = runId;
                                componentState.periodId = periodId;
                                componentState.workgroupId = workgroupId;
                                componentState.nodeId = this.nodeId;

                                // set the component id into the student work object
                                componentState.componentId = tempComponentId;

                                // set the component type
                                componentState.componentType = component.type;

                                if (componentId == null) {
                                    /*
                                     * the node has triggered the save so all the components will
                                     * either have isAutoSave set to true or false
                                     */
                                    componentState.isAutoSave = isAutoSave;
                                } else {
                                    /*
                                     * a component has triggered the save so that component will
                                     * have isAutoSave set to false but all other components will
                                     * have isAutoSave set to true
                                     */

                                    if (componentId === tempComponentId) {
                                        // this component triggered the save
                                        componentState.isAutoSave = false;
                                    } else {
                                        // this component did not trigger the save
                                        componentState.isAutoSave = true;
                                    }
                                }

                                // add the student work object to our components array
                                componentStates.push(componentState);
                            }
                        }
                    }
                }
            }

            return componentStates;
        };

        /**
         * Loop through this node's components and get annotations
         * @param isAutoSave whether the component states were auto saved
         * @param componentId (optional) the component id of the component
         * that triggered the save
         * @returns an array of component states
         */
        this.getComponentAnnotations = function () {
            var componentAnnotations = [];

            // get the components for this node
            var components = this.getComponents();

            if (components != null) {

                // loop through all the components
                for (var c = 0; c < components.length; c++) {

                    // get a component
                    var component = components[c];

                    if (component != null) {
                        // get the component id
                        var tempComponentId = component.id;

                        // get the scope for the component
                        var childScope = $scope.componentToScope[tempComponentId];

                        if (childScope != null) {

                            var componentState = null;

                            if (childScope.getUnSavedAnnotation != null) {
                                // get the student work object from the child scope
                                componentAnnotation = childScope.getUnSavedAnnotation();

                                if (componentAnnotation != null) {
                                    // add the student work object to our components array
                                    componentAnnotations.push(componentAnnotation);

                                    childScope.setUnSavedAnnotation(null);
                                }
                            }
                        }
                    }
                }
            }

            return componentAnnotations;
        };

        /**
         * The function that child component controllers will call to register
         * themselves with this node
         * @param childScope the child scope object
         * @param component the component content for the component
         */
        $scope.registerComponentController = function (childScope, component) {

            if ($scope != null && component != null) {
                // get the component id
                var componentId = component.id;

                // add the component id to child scope mapping
                $scope.componentToScope[componentId] = childScope;
            }
        };

        /**
         * Listen for the componentSaveTriggered event which occurs when a
         * component is requesting student data to be saved
         */
        $scope.$on('componentSaveTriggered', angular.bind(this, function (event, args) {
            var isAutoSave = false;

            if (args != null) {
                var nodeId = args.nodeId;
                var componentId = args.componentId;

                if (nodeId != null && componentId != null) {
                    if (this.nodeId == nodeId && this.nodeContainsComponent(componentId)) {
                        /*
                         * obtain the component states from the children and save them
                         * to the server
                         */
                        this.createAndSaveComponentData(isAutoSave, componentId);
                    }
                }
            }
        }));

        /**
         * Listen for the componentSubmitTriggered event which occurs when a
         * component is requesting student data to be submitted
         */
        $scope.$on('componentSubmitTriggered', angular.bind(this, function (event, args) {
            var isAutoSave = false;

            if (args != null) {
                var nodeId = args.nodeId;
                var componentId = args.componentId;

                if (nodeId != null && componentId != null) {
                    if (this.nodeId == nodeId && this.nodeContainsComponent(componentId)) {
                        /*
                         * obtain the component states from the children and save them
                         * to the server
                         */
                        this.createAndSaveComponentData(isAutoSave, componentId);
                    }
                }
            }
        }));

        /**
         * Listen for the componentStudentDataChanged event that will come from
         * child component scopes
         * @param event
         * @param args the arguments provided when the event is fired
         */
        $scope.$on('componentStudentDataChanged', angular.bind(this, function (event, args) {
            /*
             * the student data in one of our child scopes has changed so
             * we will need to save
             */
            this.isDirty = true;
            this.setSaveMessage('');

            if (args != null) {

                // get the part id
                var componentId = args.componentId;

                // get the new component state
                var componentState = args.componentState;

                if (componentId != null && componentState != null) {

                    /*
                     * notify the parts that are connected that the student
                     * data has changed
                     */
                    this.notifyConnectedParts(componentId, componentState);
                }
            }
        }));

        /**
         * Notify any connected components that the student data has changed
         * @param componentId the component id that has changed
         * @param componentState the new component state
         */
        this.notifyConnectedParts = function (changedComponentId, componentState) {

            if (changedComponentId != null && componentState != null) {

                // get all the components
                var components = this.getComponents();

                if (components != null) {

                    /*
                     * loop through all the components and look for components
                     * that are listening for the given component id to change.
                     * only notify components that are listening for changes
                     * from the specific component id.
                     */
                    for (var c = 0; c < components.length; c++) {

                        // get a component
                        var tempComponent = components[c];

                        if (tempComponent != null) {

                            // get this component id
                            var tempComponentId = tempComponent.id;

                            /*
                             * get the connected components that this component is
                             * listening for
                             */
                            var connectedComponents = tempComponent.connectedComponents;

                            if (connectedComponents != null) {

                                // loop through all the connected components
                                for (var cc = 0; cc < connectedComponents.length; cc++) {

                                    // get a connected component
                                    var connectedComponentParams = connectedComponents[cc];

                                    if (connectedComponentParams != null) {

                                        // get the connected component id
                                        var connectedComponentId = connectedComponentParams.id;

                                        // check if the component id matches the one that has changed
                                        if (connectedComponentId === changedComponentId) {

                                            var connectedComponent = this.getComponentById(connectedComponentId);

                                            // get the scope for the listening component
                                            var componentScope = $scope.componentToScope[tempComponentId];

                                            // check if the listening component has a handler function
                                            if (componentScope.handleConnectedComponentStudentDataChanged != null) {

                                                // tell the listening part to handle the student data changing
                                                componentScope.handleConnectedComponentStudentDataChanged(connectedComponent, connectedComponentParams, componentState);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        /**
         * Get the student data for a specific part
         * @param the componentId
         * @return the student data for the given component
         */
        this.getComponentStateByComponentId = function (componentId) {
            var componentState = null;

            if (componentId != null) {

                // get the latest component state for the component
                componentState = StudentDataService.getLatestComponentStateByNodeIdAndComponentId(this.nodeId, componentId);
            }

            return componentState;
        };

        /**
         * Get the student data for a specific part
         * @param the nodeId
         * @param the componentId
         * @return the student data for the given component
         */
        this.getComponentStateByNodeIdAndComponentId = function (nodeId, componentId) {
            var componentState = null;

            if (nodeId != null && componentId != null) {

                // get the latest component state for the component
                componentState = StudentDataService.getLatestComponentStateByNodeIdAndComponentId(nodeId, componentId);
            }

            return componentState;
        };

        this.nodeLoaded = function (nodeId) {
            //var newNodeVisit = StudentDataService.createNodeVisit(nodeId);
        };

        this.nodeUnloaded = function (nodeId) {
            var isAutoSave = true;

            this.createAndSaveComponentData(isAutoSave);

            // save nodeExited event
            var componentId = null;
            var componentType = null;
            var category = "Navigation";
            var event = "nodeExited";
            var eventData = {};
            eventData.nodeId = nodeId;
            StudentDataService.saveVLEEvent(nodeId, componentId, componentType, category, event, eventData);
        };

        // saves current work and adds to notebook as needed
        this.addStudentWorkItemToNotebook = function (componentId) {
            var currentNode = StudentDataService.getCurrentNode();
            if (currentNode != null) {
                var currentNodeId = currentNode.id;

                // get the scope for the component
                var childScope = $scope.componentToScope[componentId];

                if (childScope != null && childScope.isDirty()) {
                    // we need to save this component first before adding to notebook
                    var isAutoSave = false;

                    this.createAndSaveComponentData(isAutoSave, componentId).then(angular.bind(this, function (saveResult) {
                        var currentComponentState = StudentDataService.getLatestComponentStateByNodeIdAndComponentId(currentNodeId, componentId);
                        if (currentComponentState != null) {
                            NotebookService.addStudentWorkNotebookItem(currentComponentState);
                        }
                    }));
                } else {
                    // no new data to save. Get the latest componentstate and add to notebook
                    var currentComponentState = StudentDataService.getLatestComponentStateByNodeIdAndComponentId(currentNodeId, componentId);
                    if (currentComponentState != null) {
                        NotebookService.addStudentWorkNotebookItem(currentComponentState);
                    }
                }
            }
        };

        /*this.closeNode = function() {
            var currentNode = StudentDataService.getCurrentNode();
            if (currentNode != null) {
                 var currentNodeId = currentNode.id;
                 // get the parent node of the current node
                var parentNode = ProjectService.getParentGroup(currentNodeId);
                 var parentNodeId = parentNode.id;
                 // set the current node to the parent node
                StudentDataService.endCurrentNodeAndSetCurrentNodeByNodeId(parentNodeId);
            }
        };
         this.goToNextNode = function() {
            NodeService.goToNextNode();
        };
         this.goToPrevNode = function() {
            NodeService.goToPrevNode();
        };*/

        /**
         * Listen for the 'exitNode' event which is fired when the student
         * exits the node. This will perform saving when the student exits
         * the node.
         */
        $scope.$on('exitNode', angular.bind(this, function (event, args) {

            // get the node that is exiting
            var nodeToExit = args.nodeToExit;

            /*
             * make sure the node id of the node that is exiting is
             * this node
             */
            if (nodeToExit.id === this.nodeId) {
                var saveTriggeredBy = 'exitNode';

                // stop the auto save interval for this node
                this.stopAutoSaveInterval();

                /*
                 * tell the parent that this node is done performing
                 * everything it needs to do before exiting
                 */
                this.nodeUnloaded(this.nodeId);

                // check if this node has transition logic that should be run when the student exits the node
                if (NodeService.hasTransitionLogic() && NodeService.evaluateTransitionLogicOn('exitNode')) {
                    // this node has transition logic
                    NodeService.evaluateTransitionLogic();
                }
            }
        }));

        /**
         * Register the the listener that will listen for the exit event
         * so that we can perform saving before exiting.
         */
        this.registerExitListener = function () {
            /**
             * Listen for the 'exit' event which is fired when the student exits
             * the VLE. This will perform saving before exiting.
             */
            this.logOutListener = $scope.$on('exit', angular.bind(this, function (event, args) {

                // stop the auto save interval for this node
                this.stopAutoSaveInterval();

                /*
                 * tell the parent that this node is done performing
                 * everything it needs to do before exiting
                 */
                this.nodeUnloaded(this.nodeId);

                // call this function to remove the listener
                this.logOutListener();

                /*
                 * tell the session service that this listener is done
                 * performing everything it needs to do before exiting
                 */
                $rootScope.$broadcast('doneExiting');
            }));
        };

        // perform setup of this node only if the current node is not a group.
        if (StudentDataService.getCurrentNode() && ProjectService.isApplicationNode(StudentDataService.getCurrentNodeId())) {
            this.setup();
        }
    });
});