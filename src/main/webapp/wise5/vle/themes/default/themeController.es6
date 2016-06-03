'use strict';

class ThemeController {
    constructor($scope,
                $translate,
                ConfigService,
                ProjectService,
                StudentDataService,
                StudentStatusService,
                NotebookService,
                SessionService,
                $mdDialog,
                $mdMedia,
                $mdToast,
                $mdComponentRegistry) {

        this.$scope = $scope;
        this.$translate = $translate;
        this.ConfigService = ConfigService;
        this.ProjectService = ProjectService;
        this.StudentDataService = StudentDataService;
        this.NotebookService = NotebookService;
        this.SessionService = SessionService;
        this.StudentStatusService = StudentStatusService;
        this.$mdDialog = $mdDialog;
        this.$mdMedia = $mdMedia;
        this.$mdToast = $mdToast;
        this.$mdComponentRegistry = $mdComponentRegistry;

        // TODO: set these variables dynamically from theme settings
        this.layoutView = 'list'; // 'list' or 'card'
        this.numberProject = true;

        this.themePath = this.ProjectService.getThemePath();
        this.themeSettings = this.ProjectService.getThemeSettings();
        this.hideTotalScores = this.themeSettings.hideTotalScores;

        this.nodeStatuses = this.StudentDataService.nodeStatuses;
        this.idToOrder = this.ProjectService.idToOrder;

        this.rootNode = this.ProjectService.rootNode;
        this.rootNodeStatus = this.nodeStatuses[this.rootNode.id];

        this.workgroupId = this.ConfigService.getWorkgroupId();
        this.workgroupUserNames = this.ConfigService.getUserNamesByWorkgroupId(this.workgroupId);

        this.notebookOpen = false;
        this.notebookConfig = this.NotebookService.getNotebookConfig();
        this.notebookFilter = '';

        this.currentNode = this.StudentDataService.getCurrentNode();

        // set current notebook type filter to first enabled type
        if (this.notebookConfig.enabled) {
            for (var type in this.notebookConfig.itemTypes) {
                let prop = this.notebookConfig.itemTypes[type];
                if (this.notebookConfig.itemTypes.hasOwnProperty(type) && prop.enabled) {
                    this.notebookFilter = type;
                    break;
                }
            }
        }

        // build server disconnect display
        this.connectionLostDisplay = $mdToast.build({
            template: '<md-toast>\
                      <span>Server error. Check your internet connection.</span>\
                      </md-toast>',
            hideDelay: 0
        });
        this.connectionLostShown = false;

        this.setLayoutState();

        // update layout state when current node changes
        this.$scope.$on('currentNodeChanged', (event, args) => {
            this.currentNode = this.StudentDataService.getCurrentNode();
            this.setLayoutState();
        });

        // alert user when a locked node has been clicked
        this.$scope.$on('nodeClickLocked', (event, args) => {
            var message = 'Sorry, you cannot view this item yet.';
            let nodeId = args.nodeId;

            var node = this.ProjectService.getNodeById(nodeId);

            if (node != null) {

                // get the constraints that affect this node
                var constraints = this.ProjectService.getConstraintsForNode(node);

                if (constraints != null && constraints.length > 0) {
                    message = '';
                }

                // loop through all the constraints that affect this node
                for (var c = 0; c < constraints.length; c++) {
                    var constraint = constraints[c];

                    // check if the constraint has been satisfied
                    if (constraint != null && !this.StudentDataService.evaluateConstraint(node, constraint)) {
                        // the constraint has not been satisfied and is still active

                        if (message != '') {
                            // separate multiple constraints with line breaks
                            message += '<br/><br/>';
                        }

                        // get the message that describes how to disable the constraint
                        message += this.ProjectService.getConstraintMessage(nodeId, constraint);
                    }
                }
            }

            this.$translate(['itemLocked', 'ok']).then((translations) => {
                this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .parent(angular.element(document.body))
                        .title(translations.itemLocked)
                        .htmlContent(message)
                        .ariaLabel(translations.itemLocked)
                        .ok(translations.ok)
                        .targetEvent(event)
                );
            })
        });

        // alert user when inactive for a long time
        this.$scope.$on('showSessionWarning', (ev) => {
            this.$translate(["sessionTimeout", "autoLogoutMessage", "yes", "no"]).then((translations) => {

                let alert = this.$mdDialog.confirm()
                    .parent(angular.element(document.body))
                    .title(translations.sessionTimeout)
                    .textContent(translations.autoLogoutMessage)
                    .ariaLabel(translations.sessionTimeout)
                    .targetEvent(ev)
                    .ok(translations.yes)
                    .cancel(translations.no);

                this.$mdDialog.show(alert).then(() => {
                    this.SessionService.renewSession();
                    alert = undefined;
                }, () => {
                    this.SessionService.forceLogOut();
                });

            });
        });

        // alert user when server loses connection
        this.$scope.$on('serverDisconnected', () => {
            this.handleServerDisconnect();
        });

        // remove alert when server regains connection
        this.$scope.$on('serverConnected', () => {
            this.handleServerReconnect();
        });

        // show list of revisions in a dialog when user clicks the show revisions link for a component
        this.$scope.$on('showRevisions', (event, args) => {
            let revisions = args.revisions;
            let componentController = args.componentController;
            let allowRevert = args.allowRevert;
            let $event = args.$event;
            let revisionsTemplateUrl = this.themePath + '/templates/componentRevisions.html';

            this.$mdDialog.show({
                parent: angular.element(document.body),
                targetEvent: $event,
                templateUrl: revisionsTemplateUrl,
                locals: {
                    items: revisions.reverse(),
                    componentController: componentController,
                    allowRevert: allowRevert
                },
                controller: RevisionsController
            });
            function RevisionsController($scope, $mdDialog, items, componentController, allowRevert) {
                $scope.items = items;
                $scope.componentController = componentController;
                $scope.allowRevert = allowRevert;
                $scope.close = () => {
                    $mdDialog.hide();
                };
                $scope.revertWork = (componentState) => {
                    $scope.componentController.setStudentWork(componentState);
                    $scope.componentController.studentDataChanged();
                    $mdDialog.hide();
                };
            }
            RevisionsController.$inject = ["$scope", "$mdDialog", "items", "componentController", "allowRevert"];
        });

        this.$scope.$on('showStudentAssets', (event, args) => {
            let componentController = args.componentController;
            let $event = args.$event;
            let studentAssetDialogTemplateUrl = this.themePath + '/templates/studentAssetDialog.html';
            let studentAssetTemplateUrl = this.themePath + '/studentAsset/studentAsset.html';

            this.$mdDialog.show({
                parent: angular.element(document.body),
                targetEvent: $event,
                templateUrl: studentAssetDialogTemplateUrl,
                locals: {
                    studentAssetTemplateUrl: studentAssetTemplateUrl,
                    componentController: componentController
                },
                controller: StudentAssetDialogController
            });
            function StudentAssetDialogController($scope, $mdDialog, componentController) {
                $scope.studentAssetTemplateUrl = studentAssetTemplateUrl;
                $scope.componentController = componentController;
                $scope.closeDialog = function () {
                    $mdDialog.hide();
                }
            }
            StudentAssetDialogController.$inject = ["$scope", "$mdDialog", "componentController"];
        });

        // toggle notebook opened or closed on 'toggleNotebook' event
        this.$scope.$on('toggleNotebook', (event, args) => {
            let ev = args.ev;
            let open = args.open;
            this.toggleNotebook(ev, open);
        });

        // toggle notebook nav opened or closed on 'toggleNotebookNav' event
        this.$scope.$on('toggleNotebookNav', () => {
            this.toggleNotebookNav();
        });

        // update notebook filter on 'setNotebookFilter' event
        this.$scope.$on('setNotebookFilter', (event, args) => {
            let filter = args.filter;
            this.notebookFilter = filter;
        });

        // show edit note dialog on 'editNote' event
        this.$scope.$on('editNote', (event, args) => {
            let itemId = args.itemId;
            let ev = args.ev;
            this.viewNote(itemId, true, null, ev);
        });

        // show edit note dialog on 'addNewNote' event
        this.$scope.$on('addNewNote', (event, args) => {
            let ev = args.ev;
            let file = args.file;
            this.viewNote(null, true, file, ev);
        });

        // capture notebook open/close events
        this.$mdComponentRegistry.when('notebook').then(it => {
            this.$scope.$watch(() => {
                return it.isOpen();
            }, (isOpenNewValue, isOpenOldValue) => {
                if (isOpenNewValue !== isOpenOldValue) {
                    let currentNode = this.StudentDataService.getCurrentNode();
                    this.NotebookService.saveNotebookToggleEvent(isOpenNewValue, currentNode);
                }
            });
        });
    }

    /**
    * Set the layout state of the vle
    * @param state string specifying state (e.g. 'notebook'; optional)
    */
    setLayoutState(state) {
        let layoutState = 'nav'; // default layout state
        if (state) {
            layoutState = state;
        } else {
            // no state was sent, so set based on current node
            if (this.currentNode) {
                var id = this.currentNode.id;
                if (this.ProjectService.isApplicationNode(id)) {
                    // currently viewing step, so show step view
                    layoutState = 'node';
                } else if (this.ProjectService.isGroupNode(id)) {
                    // currently viewing group node, so show navigation view
                    layoutState = 'nav';
                }
            }
        }

        if (layoutState !== 'notebook') {
            this.notebookNavOpen = false;
        }

        this.layoutState = layoutState;
    }

    // show server error alert when connection is lost
    handleServerDisconnect() {
        if (!this.connectionLostShown) {
          this.$mdToast.show(this.connectionLostDisplay);
          this.connectionLostShown = true;
        }
    }

    // hide server error alert when connection is restored
    handleServerReconnect() {
        this.$mdToast.hide(this.connectionLostDisplay);
        this.connectionLostShown = false;
    }

    getAvatarColorForWorkgroupId(workgroupId) {
        return this.StudentStatusService.getAvatarColorForWorkgroupId(workgroupId);
    }

    /**
    * Open or close the notebook and save notebook open/close events
    */
    toggleNotebook(ev, open) {
        //this.notebookOpen = !this.notebookOpen;
        if (this.layoutState === 'notebook' && !open) {
            this.setLayoutState();
            this.NotebookService.saveNotebookToggleEvent(false, this.currentNode);
        } else {
            this.layoutState = 'notebook';
            this.NotebookService.saveNotebookToggleEvent(true, this.currentNode);
        }
    }

    /**
    * Open or close the notebook nav menu
    */
    toggleNotebookNav() {
        this.notebookNavOpen = !this.notebookNavOpen;
    }

    viewNote(itemId, isEditMode, file, ev) {
        let showFullScreen = this.$mdMedia('xs');
        let notebookItemTemplate = this.themePath + '/notebook/viewNotebookItem.html';
        let item = this.NotebookService.getLatestNotebookItemByLocalNotebookItemId(itemId);
        let type = item ? item.type : 'note'; // TODO: don't hardcode type once questions are enabled

        // Display a dialog where students can view/add/edit a notebook item
        this.$mdDialog.show({
            parent: angular.element(document.body),
            targetEvent: ev,
            fullscreen: showFullScreen,
            templateUrl: notebookItemTemplate,
            controller: ViewNotebookItemController,
            locals: {
                itemId: itemId,
                isEditMode: isEditMode,
                type: type,
                file: file
            }
            //template: '<notebookitem is-edit-enabled="true" item-id="{{itemId}}"></notebookitem>'
        });

        function ViewNotebookItemController($scope, $mdDialog, $q, NotebookService, StudentAssetService) {
            $scope.itemId = itemId;
            $scope.type = type;
            $scope.isEditMode = isEditMode;
            $scope.NotebookService = NotebookService;
            $scope.StudentAssetService = StudentAssetService;
            $scope.item = null;
            $scope.title = ($scope.isEditMode ? ($scope.itemId ? 'Edit ' : 'Add ') : 'View ') + $scope.type;
            $scope.file = file;
            $scope.saveEnabled = false;

            $scope.cancel = () => {
                $mdDialog.hide();
            };

            $scope.save = () => {
                // go through the notebook item's attachments and look for any attachments that need to be uploaded and made into StudentAsset.
                let uploadAssetPromises = [];
                if ($scope.item.content.attachments != null) {
                    for (let i = 0; i < $scope.item.content.attachments.length; i++) {
                        let attachment = $scope.item.content.attachments[i];
                        if (attachment.studentAssetId == null && attachment.file != null) {
                            // this attachment hasn't been uploaded yet, so we'll do that now.
                            let file = attachment.file;

                            var deferred = $q.defer();
                            $scope.StudentAssetService.uploadAsset(file).then((studentAsset) => {
                                $scope.StudentAssetService.copyAssetForReference(studentAsset).then((copiedAsset) => {
                                    if (copiedAsset != null) {
                                        var newAttachment = {
                                            studentAssetId: copiedAsset.id,
                                            iconURL: copiedAsset.iconURL
                                        };
                                        $scope.item.content.attachments[i] = newAttachment;
                                        deferred.resolve();
                                    }
                                });
                            });
                            uploadAssetPromises.push(deferred.promise);
                        }
                    }
                }

                // make sure all the assets are created before saving the notebook item.
                $q.all(uploadAssetPromises).then(() => {
                    $scope.NotebookService.saveNotebookItem($scope.item.id, $scope.item.nodeId, $scope.item.localNotebookItemId, $scope.item.type, $scope.item.title, $scope.item.content)
                        .then(() => {
                            $mdDialog.hide();
                        });
                });
            };

            $scope.update = (item) => {
                // notebook item has changed
                $scope.item = item;

                // set whether save button should be enabled
                let saveEnabled = false;
                if ($scope.item) {
                    if ($scope.item.content.text || $scope.item.content.attachments.length) {
                        // note has text and/or attachments, so we can save
                        saveEnabled = true;
                    }
                }
                $scope.saveEnabled = saveEnabled;
            };
        }
        ViewNotebookItemController.$inject = ["$scope", "$mdDialog", "$q", "NotebookService", "StudentAssetService"];
    }
}


ThemeController.$inject = [
    '$scope',
    '$translate',
    'ConfigService',
    'ProjectService',
    'StudentDataService',
    'StudentStatusService',
    'NotebookService',
    'SessionService',
    '$mdDialog',
    '$mdMedia',
    '$mdToast',
    '$mdComponentRegistry'
];

export default ThemeController;
