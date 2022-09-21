const {
	getAddCollectionScript,
	getDeleteCollectionScript,
	getAddColumnScript,
	getDeleteColumnScript,
	getModifyColumnScript,
	getModifyCollectionScript,
} = require('./alterScriptHelpers/alterEntityHelper');
const {
	getAddViewScript,
	getDeleteViewScript,
	getModifiedViewScript,
} = require('./alterScriptHelpers/alterViewHelper');

const getComparisonModelCollection = collections => {
	return collections
		.map(collection => JSON.parse(collection))
		.find(collection => collection.collectionName === 'comparisonModelCollection');
};

const getAlterContainersScripts = (collection, app, { skipModified } = {}) => {
	const { getAddContainerScript, getDeleteContainerScript, getModifyContainerScript } =
		require('./alterScriptHelpers/alterContainerHelper')(app);

	const addedContainers = collection.properties?.containers?.properties?.added?.items;
	const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
	const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

	const addContainersScripts = []
		.concat(addedContainers)
		.filter(Boolean)
		.map(container => ({ ...Object.values(container.properties)[0], name: Object.keys(container.properties)[0] }))
		.map(getAddContainerScript);
	const deleteContainersScripts = []
		.concat(deletedContainers)
		.filter(Boolean)
		.map(container => getDeleteContainerScript(Object.keys(container.properties)[0]));
	const modifyContainersScripts = []
		.concat(modifiedContainers)
		.filter(Boolean)
		.map(container => ({ ...Object.values(container.properties)[0], name: Object.keys(container.properties)[0] }))
		.map(getModifyContainerScript);

	return []
		.concat(addContainersScripts)
		.concat(deleteContainersScripts)
		.concat(skipModified ? [] : modifyContainersScripts);
};

const getAlterCollectionsScripts = (collection, app) => {
	const createCollectionsScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.created)
		.map(getAddCollectionScript(app));
	const deleteCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScript(app));
	const modifyCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.modified)
		.map(getModifyCollectionScript(app));
	const addColumnScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod?.created)
		.flatMap(getAddColumnScript(app));
	const deleteColumnScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod?.deleted)
		.flatMap(getDeleteColumnScript(app));
	const modifyColumnScript = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.flatMap(getModifyColumnScript(app));

	return [
		...createCollectionsScripts,
		...deleteCollectionScripts,
		...modifyCollectionScripts,
		...addColumnScripts,
		...deleteColumnScripts,
		...modifyColumnScript,
	].map(script => script.trim());
};

const getAlterViewScripts = (collection, app) => {
	const createViewsScripts = []
		.concat(collection.properties?.views?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.created)
		.map(getAddViewScript(app));

	const deleteViewsScripts = []
		.concat(collection.properties?.views?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.deleted)
		.map(getDeleteViewScript(app));

	const modifiedViewsScripts = []
		.concat(collection.properties?.views?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => !view.compMod?.created && !view.compMod?.deleted)
		.map(getModifiedViewScript(app));

	return [...deleteViewsScripts, ...createViewsScripts, ...modifiedViewsScripts].map(script => script.trim());
};

module.exports = {
	getComparisonModelCollection,
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
};
