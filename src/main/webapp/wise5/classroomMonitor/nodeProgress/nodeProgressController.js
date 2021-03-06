'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NodeProgressController = function () {
    function NodeProgressController($mdDialog, $scope, $state, ProjectService, StudentStatusService, TeacherDataService, TeacherWebSocketService) {
        var _this = this;

        _classCallCheck(this, NodeProgressController);

        this.$mdDialog = $mdDialog;
        this.$scope = $scope;
        this.$state = $state;
        this.ProjectService = ProjectService;
        this.StudentStatusService = StudentStatusService;
        this.TeacherDataService = TeacherDataService;
        this.TeacherWebSocketService = TeacherWebSocketService;
        this.currentGroup = null;

        this.items = this.ProjectService.idToOrder;

        this.nodeId = null;
        var stateParams = null;
        var stateParamNodeId = null;

        if (this.$state != null) {
            stateParams = this.$state.params;
        }

        if (stateParams != null) {
            stateParamNodeId = stateParams.nodeId;
        }

        if (stateParamNodeId != null && stateParamNodeId !== '') {
            this.nodeId = stateParamNodeId;
        }

        if (this.nodeId == null || this.nodeId === '') {
            this.nodeId = this.ProjectService.rootNode.id;
        }

        this.TeacherDataService.setCurrentNodeByNodeId(this.nodeId);

        var startNodeId = this.ProjectService.getStartNodeId();
        this.rootNode = this.ProjectService.getRootNode(startNodeId);

        this.currentGroup = this.rootNode;

        if (this.currentGroup != null) {
            this.currentGroupId = this.currentGroup.id;
            this.$scope.currentgroupid = this.currentGroupId;
        }

        var flattenedProjectNodeIds = this.ProjectService.getFlattenedProjectAsNodeIds();
        //console.log(JSON.stringify(flattenedProjectNodeIds, null, 4));

        var branches = this.ProjectService.getBranches();

        var currentPeriod = this.getCurrentPeriod();

        if (currentPeriod) {
            this.isPaused = this.TeacherDataService.isPeriodPaused(currentPeriod.periodId);
        }

        this.showRubricButton = false;

        if (this.projectHasRubric()) {
            this.showRubricButton = true;
        }

        /**
         * Listen for current node changed event
         */
        this.$scope.$on('currentNodeChanged', function (event, args) {
            var previousNode = args.previousNode;
            var currentNode = args.currentNode;
            if (previousNode != null && previousNode.type === 'group') {
                var _nodeId = previousNode.id;
            }

            if (currentNode != null) {

                _this.nodeId = currentNode.id;
                _this.TeacherDataService.setCurrentNode(currentNode);

                if (_this.isGroupNode(_this.nodeId)) {
                    // current node is a group

                    _this.currentGroup = currentNode;
                    _this.currentGroupId = _this.currentGroup.id;
                    _this.$scope.currentgroupid = _this.currentGroupId;
                    //} else if (this.isApplicationNode(this.nodeId)) {
                }
            }

            _this.$state.go('root.nodeProgress', { nodeId: _this.nodeId });
        });

        /**
         * Listen for current period changed event
         */
        this.$scope.$on('currentPeriodChanged', function (event, args) {
            var currentPeriod = args.currentPeriod;
            _this.isPaused = _this.TeacherDataService.isPeriodPaused(currentPeriod.periodId);
        });

        /**
         * Listen for state change event
         */
        this.$scope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState, fromParams) {
            var toNodeId = toParams.nodeId;
            var fromNodeId = fromParams.nodeId;
            if (toNodeId && fromNodeId && toNodeId !== fromNodeId) {
                _this.TeacherDataService.endCurrentNodeAndSetCurrentNodeByNodeId(toNodeId);
            }

            if (toState.name === 'root.project') {
                var _nodeId2 = toParams.nodeId;
                if (_this.ProjectService.isApplicationNode(_nodeId2)) {
                    // scroll to top when viewing a new step
                    document.getElementById('content').scrollTop = 0;
                }
            }
        });

        // save event when node progress view is displayed
        var context = "ClassroomMonitor",
            nodeId = this.nodeId,
            componentId = null,
            componentType = null,
            category = "Navigation",
            event = "nodeProgressViewDisplayed",
            data = { nodeId: this.nodeId };
        this.TeacherDataService.saveEvent(context, nodeId, componentId, componentType, category, event, data);
    }

    _createClass(NodeProgressController, [{
        key: 'isGroupNode',
        value: function isGroupNode(nodeId) {
            return this.ProjectService.isGroupNode(nodeId);
        }
    }, {
        key: 'isApplicationNode',
        value: function isApplicationNode(nodeId) {
            return this.ProjectService.isApplicationNode(nodeId);
        }

        /**
         * Get the current period
         */

    }, {
        key: 'getCurrentPeriod',
        value: function getCurrentPeriod() {
            return this.TeacherDataService.getCurrentPeriod();
        }

        /**
         * Get the number of students on the node
         * @param nodeId the node id
         * @returns the number of students that are on the node
         */

    }, {
        key: 'getNumberOfStudentsOnNode',
        value: function getNumberOfStudentsOnNode(nodeId) {
            // get the currently selected period
            var currentPeriod = this.getCurrentPeriod();
            var periodId = currentPeriod.periodId;

            // get the number of students that are on the node in the period
            var count = this.StudentStatusService.getWorkgroupIdsOnNode(nodeId, periodId).length;

            return count;
        }

        /**
         * Get the percentage of the class or period that has completed the node
         * @param nodeId the node id
         * @returns the percentage of the class or period that has completed the node
         */

    }, {
        key: 'getNodeCompletion',
        value: function getNodeCompletion(nodeId) {
            // get the currently selected period
            var currentPeriod = this.getCurrentPeriod();
            var periodId = currentPeriod.periodId;

            // get the percentage of the class or period that has completed the node
            var completionPercentage = this.StudentStatusService.getNodeCompletion(nodeId, periodId);

            return completionPercentage;
        }

        /**
         * The pause screen status was changed. Update period(s) accordingly.
         */

    }, {
        key: 'pauseScreensChanged',
        value: function pauseScreensChanged(isPaused) {
            this.TeacherDataService.pauseScreensChanged(isPaused);
        }

        /**
         * Check if the project has a rubric
         * @return whether the project has a rubric
         */

    }, {
        key: 'projectHasRubric',
        value: function projectHasRubric() {

            // get the project rubric
            var projectRubric = this.ProjectService.getProjectRubric();

            if (projectRubric != null && projectRubric != '') {
                // the project has a rubric
                return true;
            }

            return false;
        }

        /**
         * Show the rubric in the grading view. We will show the step rubric and the
         * component rubrics.
         */

    }, {
        key: 'showProjectRubric',
        value: function showProjectRubric() {

            var projectRubric = "<div style='margin-left:30px;margin-right:30px;margin-top:30px;margin-bottom:30px;'>";

            // get the project title
            projectRubric += '<h3>' + this.ProjectService.getProjectTitle() + '</h3>';

            // get the project rubric
            projectRubric += this.ProjectService.replaceAssetPaths(this.ProjectService.getProjectRubric());

            projectRubric += '</div>';

            // display the rubrics in a popup
            this.$mdDialog.show({
                template: projectRubric,
                clickOutsideToClose: true,
                escapeToClose: true
            });
        }
    }]);

    return NodeProgressController;
}();

NodeProgressController.$inject = ['$mdDialog', '$scope', '$state', 'ProjectService', 'StudentStatusService', 'TeacherDataService', 'TeacherWebSocketService'];

exports.default = NodeProgressController;
//# sourceMappingURL=nodeProgressController.js.map