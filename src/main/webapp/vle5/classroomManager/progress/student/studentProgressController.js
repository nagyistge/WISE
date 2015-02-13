define(['app'], function(app) {

	app
	.$controllerProvider
	.register('StudentProgressController', 	function ($state, StudentStatusService, UserAndClassInfoService, AnnotationService) {
		this.title = 'Student Progress';
		
		this.studentStatuses = StudentStatusService.getStudentStatuses();
		
		this.workgroups = UserAndClassInfoService.getClassmateUserInfos();
		
		this.annotations = AnnotationService.getAnnotations();
		
		this.getCurrentStepForWorkgroupId = function(workgroupId) {
			return StudentStatusService.getCurrentStepTitleForWorkgroupId(workgroupId);
		};
		
		this.getStudentProjectCompletion = function(workgroupId) {
			return StudentStatusService.getStudentProjectCompletion(workgroupId);
		};
		
		this.studentRowClicked = function(workgroup) {
			var workgroupId = workgroup.workgroupId;
	
			$state.go('studentGrading', {workgroupId:workgroupId});
		};
	});
	
});