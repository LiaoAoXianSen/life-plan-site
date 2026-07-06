(function () {
    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = !!checked;
    }

    function resetMilestoneFields() {
        HabitEngine.getMilestoneDefaults().forEach(item => {
            setChecked(`habit-milestone-${item.days}-enabled`, false);
            setValue(`habit-milestone-${item.days}-reward`, '0');
            setValue(`habit-milestone-${item.days}-currency`, HabitEngine.DEFAULT_CURRENCY);
            setValue(`habit-milestone-${item.days}-penalty`, '0');
            setValue(`habit-milestone-${item.days}-penalty-currency`, HabitEngine.DEFAULT_CURRENCY);
        });
    }

    function loadMilestoneFields(milestones) {
        HabitEngine.normalizeMilestoneRewards(milestones).forEach(item => {
            setChecked(`habit-milestone-${item.days}-enabled`, item.enabled);
            setValue(`habit-milestone-${item.days}-reward`, item.rewardAmount);
            setValue(`habit-milestone-${item.days}-currency`, item.currency);
            setValue(`habit-milestone-${item.days}-penalty`, item.penaltyAmount);
            setValue(`habit-milestone-${item.days}-penalty-currency`, item.penaltyCurrency);
        });
    }

    function collectMilestoneFields() {
        return HabitEngine.MILESTONE_DAYS.map(days => ({
            days,
            enabled: !!document.getElementById(`habit-milestone-${days}-enabled`)?.checked,
            rewardAmount: Math.max(0, parseInt(document.getElementById(`habit-milestone-${days}-reward`)?.value || '0', 10) || 0),
            currency: HabitEngine.normalizeCurrency(document.getElementById(`habit-milestone-${days}-currency`)?.value),
            penaltyAmount: Math.max(0, parseInt(document.getElementById(`habit-milestone-${days}-penalty`)?.value || '0', 10) || 0),
            penaltyCurrency: HabitEngine.normalizeCurrency(document.getElementById(`habit-milestone-${days}-penalty-currency`)?.value)
        }));
    }

    window.HabitUi = {
        resetMilestoneFields,
        loadMilestoneFields,
        collectMilestoneFields
    };
})();
